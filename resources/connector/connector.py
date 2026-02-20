#!/usr/bin/env python

import argparse
import os
import sys
import asyncio
import json
import socketio
import tempfile
import threading
import uuid
from pathlib import Path
from typing import Dict, Optional, Any, Coroutine
import time
from aider import models, utils
from aider.models import ModelSettings
from aider.coders import Coder
from aider.commands import Commands
from aider.io import InputOutput, AutoCompleter
from aider.watch import FileWatcher
from aider.main import main as cli_main
from aider.utils import is_image_file
from concurrent.futures import ThreadPoolExecutor, Future
import nest_asyncio
import litellm
import types
import portalocker

class PromptContext:
  def __init__(self, id: str, group=None, auto_approve=False, deny_commands=False):
    self.id = id
    self.group = group
    self.auto_approve = auto_approve
    self.deny_commands = deny_commands

nest_asyncio.apply()

confirmation_result = None

def update_model_params(models_info, model):
  model_id = model.name

  try:
    from aider.models import model_info_manager
    if model_id in model_info_manager.local_model_metadata:
      sys.stdout.write(f"Model {model_id} is included in local models, skipping update.\n")
      return
  except ImportError:
    sys.stderr.write(f"Failed to import model_info_manager, skipping update.\n")

  if not model_id in models_info:
    sys.stdout.write(f"Model {model_id} is not in models_info, skipping update.\n")
    return

  info = models_info[model_id]
  max_input_tokens = info.get("maxInputTokens")
  if max_input_tokens is None:
    # skip models that don't have maxInputTokens defined
    sys.stdout.write(f"Skipping model: {model_id} as it doesn't have maxInputTokens defined")
    return

  model_info = {
    "max_tokens": info.get('maxOutputTokens') or 32000,
    "max_input_tokens": max_input_tokens,
    "max_output_tokens": info.get('maxOutputTokens') or 32000,
    "input_cost_per_token": info.get('inputCostPerToken') or 0,
    "output_cost_per_token": info.get('outputCostPerToken') or 0,
    "cache_creation_input_token_cost": info.get('cacheWriteInputTokenCost'),
    "cache_read_input_token_cost": info.get('cacheReadInputTokenCost'),
    "litellm_provider": model_id.split("/")[0],
    "mode": "chat"
  }
  model.info = model_info

  max_input_tokens = model.info.get('max_input_tokens') if model.info else None
  if max_input_tokens:
    model.max_chat_history_tokens = min(max(max_input_tokens / 16, 1024), 8192)

  max_output_tokens = model.info.get('max_output_tokens') if model.info else None
  if max_output_tokens is not None:
    if model.extra_params is None:
      model.extra_params = {}
    if "gpt-5" in model.name:
      model.extra_params["max_completion_tokens"] = max_output_tokens
    elif model.extra_params.get("max_completion_tokens") is None:
      model.extra_params["max_tokens"] = max_output_tokens

  temperature = info.get('temperature')
  model.use_temperature = temperature if temperature is not None else False

def wait_for_async(connector, coroutine):
  try:
    if threading.current_thread() is threading.main_thread():
      # Called from the main thread
      task = connector.loop.create_task(coroutine)
      result = connector.loop.run_until_complete(task)
      return result
    else:
      # Called from another thread
      future = asyncio.run_coroutine_threadsafe(coroutine, connector.loop)
      result = future.result()
      return result
  except Exception as e:
    sys.stderr.write(f"Error in wait_for_async: {str(e)}\n")
    return None

class PromptExecutor:
  """Manages prompt execution as concurrent asyncio tasks."""

  def __init__(self, connector):
    self.connector = connector
    self.active_prompts: Dict[str, asyncio.Task] = {}
    self.active_coders: Dict[str, Coder] = {}
    self.active_futures: Dict[str, Future] = {}
    self.executor = None

  def get_executor(self):
    if self.executor is None:
      # create a new executor with 100 workers for 100 concurrent prompts
      self.executor = ThreadPoolExecutor(max_workers=100)
    return self.executor

  async def run_prompt(self, prompt: str, prompt_context: PromptContext, mode=None, architect_model=None, messages=None, files=None, coder=None):
    prompt_coro = self._run_prompt_task(prompt, prompt_context, mode, architect_model, messages, files, coder)

    # Submit the coroutine to the executor, which turns it into a background Task.
    # If a prompt with the same ID is already running, cancel it first.
    if prompt_context.id in self.active_prompts:
      await self.cancel_prompt(prompt_context)

    # Wrap the coroutine in a task that will handle its own cleanup.
    task = self.connector.loop.create_task(self._execute_prompt_wrapper(prompt_context, prompt_coro))
    self.active_prompts[prompt_context.id] = task

    return prompt_context.id

  # This new method contains the logic that used to be in _run_prompt_sync and _run_prompt_async
  async def _run_prompt_task(self, prompt: str, prompt_context: PromptContext, mode=None, architect_model=None, messages=None, files=None, coder=None):
    """The actual prompt execution logic, designed to be run as a task."""
    try:
      # The core async logic from your old `_run_prompt_async`
      # Now you can directly await async functions without any special handling.
      await self._run_prompt_async(prompt, prompt_context, mode, architect_model, messages, files, coder)

    except asyncio.CancelledError:
      # This is important! The task must be allowed to handle its own cancellation.
      self.connector.coder.io.tool_output(f"Prompt logic for {prompt_context.id} gracefully cancelled.")
      # Propagate the cancellation to ensure the wrapper knows about it.
      raise
    except Exception as e:
      self.connector.coder.io.tool_error(f"Error in prompt logic {prompt_context.id}: {str(e)}")
      raise

  async def _stream_and_send_responses(self, coder, prompt_context, prompt_to_run, log_context, extra_response_data=None):
    if extra_response_data is None:
      extra_response_data = {}

    whole_content = ""
    response_id = str(uuid.uuid4())

    queue = asyncio.Queue()
    executor = self.get_executor()

    def _sync_worker():
      try:
        for chunk in coder.run_stream(prompt_to_run):
          if self.is_prompt_interrupted(prompt_context.id):
            break
          # Put chunk into queue, handling potential queue full
          fut = asyncio.run_coroutine_threadsafe(queue.put(chunk), self.connector.loop)
          fut.result() # Wait for it to be put in queue
        asyncio.run_coroutine_threadsafe(queue.put(None), self.connector.loop).result() # Sentinel for end
      except Exception as e:
        self.connector.coder.io.tool_error(f"Error in run_stream for {log_context}: {str(e)}")

    future = self.connector.loop.run_in_executor(executor, _sync_worker)
    self.active_futures[prompt_context.id] = future

    while True:
      chunk = await queue.get()
      if chunk is None:
        break
      whole_content += chunk

      response_payload = {
        "id": response_id,
        "action": "response",
        "finished": False,
        "content": chunk,
        "promptContext": {"id": prompt_context.id, "group": prompt_context.group if hasattr(prompt_context, 'group') else None},
      }
      if extra_response_data:
        response_payload.update(extra_response_data)

      await self.connector.send_action(response_payload, False)

    return whole_content, response_id

  async def _run_prompt_async(self, prompt: str, prompt_context: PromptContext, mode=None, architect_model=None, messages=None, files=None, coder=None):
    coder_provided = coder is not None
    sequence_number = 0

    if not coder_provided:
      coder_model = self.connector.coder.main_model
      running_model = self.connector.coder.main_model

      if mode == "architect" and architect_model:
        running_model = models.Model(architect_model, weak_model=coder_model.weak_model.name, editor_model=coder_model.name)

        # check if we have temperature info for the architect model
        if self.connector.models_info and self.connector.models_info.get(architect_model):
          update_model_params(self.connector.models_info, running_model)

        sequence_number = -1

      coder = clone_coder(
        self.connector,
        self.connector.coder,
        prompt_context,
        messages,
        files,
        edit_format=mode,
        main_model=running_model,
      )

    # we are sending all the additional messages after the prompt finishes
    coder.io.add_command_to_context = False

    self.active_coders[prompt_context.id] = coder

    # we need to disable auto accept as this does not work properly with AiderDesk
    coder.auto_accept_architect=False

    # setting usage report to None to avoid no attribute error
    coder.usage_report = None

    whole_content, response_id = await self._stream_and_send_responses(coder, prompt_context, prompt, prompt_context.id)

    if not whole_content and not self.is_prompt_interrupted(prompt_context.id):
      # if there was no content, use the partial_response_content value (case for non streaming models)
      whole_content = coder.partial_response_content

    def get_usage_report():
      return (coder.usage_report + f" Total cost: ${coder.total_cost:.10f} session") if coder.usage_report else None

    # Send final response with complete data
    response_data = {
      "id": response_id,
      "action": "response",
      "content": whole_content,
      "finished": True,
      "editedFiles": list(coder.aider_edited_files),
      "usageReport": get_usage_report(),
      "sequenceNumber": sequence_number,
      "promptContext": {"id": prompt_context.id, "group": prompt_context.group if hasattr(prompt_context, 'group') else None},
    }

    # Add commit info if there was one
    if coder.last_aider_commit_hash:
      response_data.update({
        "commitHash": coder.last_aider_commit_hash,
        "commitMessage": coder.last_aider_commit_message,
      })
      # Add diff if there was a commit
      commits = f"{coder.last_aider_commit_hash}~1"
      if coder.repo:
        diff = coder.repo.diff_commits(
          coder.pretty,
          commits,
          coder.last_aider_commit_hash,
        )
        response_data["diff"] = diff

    if whole_content or not self.is_prompt_interrupted(prompt_context.id):
      await self.connector.send_action(response_data)

    # Check for reflections
    if coder.reflected_message:
      # send newly added context files
      await self.connector.send_add_context_files(coder)

      current_reflection = 0
      while coder.reflected_message and not self.is_prompt_interrupted(prompt_context.id):
        if current_reflection >= 5:
          coder.io.tool_warning(f"Only 5 reflections allowed, stopping.")
          break

        reflection_prompt = coder.reflected_message
        await self.connector.send_log_message("loading", "Reflecting message...", False, prompt_context)

        whole_content, response_id = await self._stream_and_send_responses(
          coder, prompt_context, reflection_prompt,
          f"reflection in {prompt_context.id}",
          {"reflectedMessage": reflection_prompt}
        )

        sequence_number += 1
        response_data = {
          "id": response_id,
          "action": "response",
          "content": whole_content,
          "reflectedMessage": reflection_prompt,
          "finished": True,
          "editedFiles": list(coder.aider_edited_files),
          "usageReport": get_usage_report(),
          "sequenceNumber": sequence_number,
          "promptContext": {"id": prompt_context.id, "group": prompt_context.group if hasattr(prompt_context, 'group') else None},
        }

        if whole_content or not self.is_prompt_interrupted(prompt_context.id):
          await self.connector.send_action(response_data)

        # await self.connector.send_update_context_files()
        current_reflection += 1

    if not coder_provided:
      self.connector.coder.total_cost = coder.total_cost
      self.connector.coder.aider_commit_hashes = coder.aider_commit_hashes

    # Send prompt-finished message
    await self.connector.send_action({
      "action": "prompt-finished",
      "promptId": prompt_context.id
    })

    # Send command outputs as context messages
    if hasattr(coder, 'command_outputs') and coder.command_outputs:
      for output in coder.command_outputs:
        await self.connector.send_add_context_message("user", output)
        await self.connector.send_add_context_message("assistant", "Ok.")

  async def _execute_prompt_wrapper(self, prompt_context: PromptContext, prompt_coro: Coroutine[Any, Any, Any]):
    """
    Wrapper that executes the prompt coroutine and handles completion or cancellation.
    """
    prompt_id = prompt_context.id

    try:
      # The main logic is now simply awaiting the coroutine
      await prompt_coro
    except asyncio.CancelledError:
      # This is the clean way to handle cancellation.
      self.connector.coder.io.tool_output(f"Prompt {prompt_id} was cancelled.")
      # You could add more specific cleanup logic here if needed.
    except Exception as e:
      self.connector.coder.io.tool_error(f"Error in prompt task {prompt_id}: {str(e)}")
      # Potentially re-raise or handle as needed
      raise
    finally:
      # Always clean up the task from the active prompts dict.
      self._cleanup_prompt(prompt_id)

  def _cleanup_prompt(self, prompt_id: str):
    """Clean up completed or cancelled prompt."""
    self.active_prompts.pop(prompt_id, None)
    self.active_coders.pop(prompt_id, None)
    self.active_futures.pop(prompt_id, None)

  def get_coder(self, prompt_id: str) -> Optional[Coder]:
    """Retrieve the coder instance for a given prompt ID."""
    return self.active_coders.get(prompt_id)

  async def cancel_prompt(self, prompt_id: str) -> bool:
    """Cancel a specific prompt task."""

    # Cancel the executor future if it exists
    if prompt_id in self.active_futures:
      future = self.active_futures[prompt_id]
      future.cancel()

    # Set the coder's IO to cancelled if it exists
    if prompt_id in self.active_coders:
      coder = self.active_coders[prompt_id]
      if hasattr(coder.io, 'cancelled'):
        coder.io.cancelled = True

    if prompt_id in self.active_prompts:
      task = self.active_prompts[prompt_id]

      # The cancel() method schedules the task to be cancelled.
      # It will raise CancelledError at the next `await`.
      task.cancel()

      # You can optionally wait for it to be fully cancelled.
      try:
        await task
      except asyncio.CancelledError:
        pass # Expected

      self.connector.coder.io.tool_output(f"Cancellation request sent to prompt {prompt_id}.")
      return True
    return False

  async def interrupt_all_prompts(self):
    """Interrupt all active prompts."""
    # Create a copy of keys to avoid issues with modifying the dict while iterating
    prompt_ids = list(self.active_prompts.keys())
    if prompt_ids:
      self.connector.coder.io.tool_output("Interrupting all active prompts...")
      await asyncio.gather(*(self.cancel_prompt(pid) for pid in prompt_ids))

  def is_prompt_interrupted(self, prompt_id: str) -> bool:
    """Check if a prompt task has been cancelled."""
    if prompt_id in self.active_prompts:
      return self.active_prompts[prompt_id].done() and self.active_prompts[prompt_id].cancelled()
    # If it's not in active_prompts, it's finished or was cancelled.
    return True

  async def shutdown(self):
    """Shutdown the executor by cancelling all active tasks."""
    await self.interrupt_all_prompts()

async def run_editor_coder_stream(architect_coder, connector, prompt_context):
  # Use the editor_model from the main_model if it exists, otherwise use the main_model itself
  editor_model = architect_coder.main_model.editor_model or architect_coder.main_model
  # Generate a prompt info for the editor coder
  editor_prompt_context = PromptContext(str(uuid.uuid4()), prompt_context.group)

  editor_coder = clone_coder(
    connector,
    architect_coder,
    editor_prompt_context,
    main_model=editor_model,
    edit_format=connector.coder.edit_format,
    suggest_shell_commands=False,
    map_tokens=0,
    total_cost=architect_coder.total_cost,
    cache_prompts=False,
    num_cache_warming_pings=0,
  )
  editor_coder.cur_messages = []
  editor_coder.done_messages = []

  # Start the prompt execution (non-blocking)

  await connector.prompt_executor.run_prompt(architect_coder.partial_response_content, editor_prompt_context, "code", coder=editor_coder)

  # Wait for completion by awaiting the task
  if editor_prompt_context.id in connector.prompt_executor.active_prompts:
    task = connector.prompt_executor.active_prompts[editor_prompt_context.id]
    try:
      await task
      architect_coder.aider_edited_files = editor_coder.aider_edited_files
      architect_coder.total_cost = editor_coder.total_cost
      architect_coder.aider_commit_hashes = editor_coder.aider_commit_hashes
    except asyncio.CancelledError:
      pass # The task was cancelled, which is an expected way for it to end.

class ConnectorInputOutput(InputOutput):
  def __init__(self, connector=None, prompt_context=None, **kwargs):
    super().__init__(**kwargs)
    self.connector = connector
    self.prompt_context = prompt_context
    self.running_shell_command = False
    self.processing_loading_message = False
    self.current_command = None
    self.add_command_to_context = True
    self.cancelled = False

  def add_to_input_history(self, input_text):
    # handled by AiderDesk
    pass

  def tool_output(self, *messages, log_only=False, bold=False):
    if self.cancelled:
      return
    super().tool_output(*messages, log_only=log_only, bold=bold)
    if self.running_shell_command:
      for message in messages:
        # Extract current command from "Running" messages
        if message.startswith("Running ") and not self.current_command:
          async def send_use_command_output():
            await self.connector.send_action({
              "action": "use-command-output",
              "command": self.current_command,
            })

          self.current_command = message[8:]
          wait_for_async(self.connector, send_use_command_output())
    else:
      for message in messages:
        if message.startswith("Commit ") or message.startswith("Retrying in "):
          wait_for_async(self.connector, self.connector.send_log_message("info", message, True, self.prompt_context))

  def is_warning_ignored(self, message):
    if message == "Warning: it's best to only add files that need changes to the chat.":
      return True
    if message == "https://aider.chat/docs/troubleshooting/edit-errors.html":
      return True
    if message.endswith("Unknown context window size and costs, using sane defaults."):
      return True
    return False

  def tool_warning(self, message="", strip=True):
    if self.cancelled:
      return
    super().tool_warning(message, strip)
    if self.connector and not self.is_warning_ignored(message):
      wait_for_async(self.connector, self.connector.send_log_message("warning", message, self.processing_loading_message, self.prompt_context))

  def is_error_ignored(self, message):
    if message.strip().startswith("Scanning repo:"):
      return True
    if message.endswith("is already in the chat as a read-only file"):
      return True
    if message.endswith("is already in the chat as an editable file"):
      return True
    if message.strip().endswith("file not found error"):
      return True
    if ": unable to read:" in message and "No such file or directory" in message:
      return True

    return False

  def tool_error(self, message="", strip=True):
    if self.cancelled:
      return
    super().tool_error(message, strip)
    if self.connector and not self.is_error_ignored(message):
      sys.stderr.write(f"ERROR: {message}\n")
      wait_for_async(self.connector, self.connector.send_log_message("error", message, False, self.prompt_context))

  def confirm_ask(
    self,
    question,
    default="y",
    subject=None,
    explicit_yes_required=False,
    group=None,
    allow_never=False,
  ):
    result = None

    if self.yes is True:
      result = "y"

    if group and group.preference == "y":
      result = "y"
    elif group and group.preference == "n":
      result = "n"

    if not self.connector:
      return False

    # Reset the result
    global confirmation_result
    confirmation_result = None

    # Create coroutine for emitting the question
    async def ask_question():
      await self.connector.sio.emit('message', {
        'action': 'ask-question',
        'question': question,
        'subject': subject,
        'isGroupQuestion': group is not None,
        'defaultAnswer': default
      })
      while confirmation_result is None:
        await asyncio.sleep(0.25)
      return confirmation_result

    if question == "Add URL to the chat?":
      # we are handling this in AiderDesk differently
      return False

    if self.prompt_context:
      if question.startswith("Run shell command") and self.prompt_context.deny_commands:
        return False

      if self.prompt_context.auto_approve:
        if question == "Edit the files?":
          result = "y"
        else:
          return True

    if result is None:
      result = wait_for_async(self.connector, ask_question())

    if result == "y" and question == "Edit the files?":
      # Get the specific coder for this prompt
      coder_for_prompt = self.connector.prompt_executor.get_coder(self.prompt_context.id) if self.prompt_context else None
      if coder_for_prompt: # Ensure we have a valid coder
        # Process architect coder
        wait_for_async(self.connector, self.connector.send_log_message("loading", "Editing files...", False, self.prompt_context))
        wait_for_async(self.connector, run_editor_coder_stream(coder_for_prompt, self.connector, self.prompt_context))
      return False

    if result == "y" and question.startswith("Run shell command"):
      self.running_shell_command = True
      self.current_command = None
    if question.endswith("command output to the chat?"):
      self.reset_state((result == "y" or result == "a") and self.add_command_to_context)

    if result == "a" and group is not None:
      group.preference = "y"
    elif result == "s" and group is not None:
      group.preference = "n"

    return result == "y" or result == "a"

  def reset_state(self, add_command_to_context=None):
    if self.current_command:
      wait_for_async(self.connector, self.connector.send_action({
        "action": "use-command-output",
        "command": self.current_command,
        "addToContext": add_command_to_context if add_command_to_context is not None else self.add_command_to_context,
        "finished": True
      }))

      self.running_shell_command = False
      self.processing_loading_message = False
      self.current_command = None

  def interrupt_input(self):
    async def process_changes():
      lock_file_path = Path(self.connector.base_dir) / '.aider-desk' / 'watch-files.lock'
      lock_file = None

      try:
        # Create lock file directory if it doesn't exist
        lock_file_path.parent.mkdir(parents=True, exist_ok=True)

        # Try to acquire lock file
        lock_file = open(lock_file_path, 'w')
        try:
          # Try to acquire exclusive lock (non-blocking)
          portalocker.lock(lock_file, portalocker.LOCK_EX | portalocker.LOCK_NB)

          # Successfully acquired lock, proceed with processing
          await self.connector.send_log_message("loading", "Processing request...", False, prompt_context)
          await self.connector.prompt_executor.run_prompt(prompt, prompt_context, "code", files=[{"path": file_path, "readOnly": False} for file_path in sorted(self.connector.file_watcher.changed_files)])

          # Wait for completion by awaiting the task
          if prompt_context.id in self.connector.prompt_executor.active_prompts:
            task = self.connector.prompt_executor.active_prompts[prompt_context.id]
            try:
              await task
              await self.connector.send_add_context_files()
            except asyncio.CancelledError:
              pass # The task was cancelled, which is an expected way for it to end.
            finally:
              prompt_context.group["finished"] = True
              await self.connector.send_log_message("loading", "", True, prompt_context)
              self.connector.file_watcher.start()

        except (IOError, BlockingIOError, OSError, portalocker.LockException):
          # Lock is held by another process, skip processing
          self.connector.coder.io.tool_output("File changes already being processed by another task, skipping...")
          return

      except Exception as e:
        self.connector.coder.io.tool_error(f"Error in file changes processing: {str(e)}")
      finally:
        # Explicitly close the lock file to release the lock
        if lock_file:
          lock_file.close()

    if self.connector.file_watcher:
      prompt = self.connector.file_watcher.process_changes()
      if prompt:
        changed_files = ", ".join(sorted(self.connector.file_watcher.changed_files))
        group = {
          "id": str(uuid.uuid4()),
          "name": f"AI request detected in files: {changed_files}",
          "color": "var(--color-agent-ai-request)"
        }
        prompt_context = PromptContext(str(uuid.uuid4()), group)

        self.connector.loop.create_task(process_changes())

def clone_coder(connector, coder, prompt_context=None, messages=None, files=None, **kwargs):
  kwargs["from_coder"] = coder
  kwargs["summarize_from_coder"] = False

  coder = Coder.create(**kwargs)
  create_io(connector, coder, prompt_context)
  connector.monkey_patch_coder_functions(coder)

  if coder.repo:
    connector.monkey_patch_repo_functions(coder.repo, prompt_context)

  if messages is not None:
    # Set messages from the provided data
    coder.done_messages = [dict(role=msg['role'], content=msg['content']) for msg in messages]
    coder.cur_messages = []

  if files is not None:
    # Set files from the provided data
    coder.abs_fnames = set()
    coder.abs_read_only_fnames = set()

    for file in files:
      file_path = file['path']
      if not file_path.startswith(connector.task_dir):
        file_path = os.path.join(connector.task_dir, file_path)

      if file.get('readOnly', False):
        coder.abs_read_only_fnames.add(file_path)
      else:
        coder.abs_fnames.add(file_path)


  return coder

def create_base_coder(connector):
  coder = cli_main(return_coder=True)
  if not isinstance(coder, Coder):
    raise ValueError(coder)

  return coder

def create_io(connector, coder, prompt_context=None):
  io = ConnectorInputOutput(
    connector=connector,
    prompt_context=prompt_context,
    pretty=False,
    yes=None,
    chat_history_file=coder.io.chat_history_file,
    input=coder.io.input,
    output=coder.io.output,
    user_input_color=coder.io.user_input_color,
    tool_output_color=coder.io.tool_output_color,
    tool_warning_color=coder.io.tool_warning_color,
    tool_error_color=coder.io.tool_error_color,
    completion_menu_color=coder.io.completion_menu_color,
    completion_menu_bg_color=coder.io.completion_menu_bg_color,
    completion_menu_current_color=coder.io.completion_menu_current_color,
    completion_menu_current_bg_color=coder.io.completion_menu_current_bg_color,
    assistant_output_color=coder.io.assistant_output_color,
    code_theme=coder.io.code_theme,
    dry_run=coder.io.dry_run,
    encoding=coder.io.encoding,
    llm_history_file=coder.io.llm_history_file,
    editingmode=coder.io.editingmode,
    fancy_input=False
  )

  coder.commands.io = io
  coder.io = io
  if coder.repo:
    coder.repo.io = io

  return io

class Connector:
  def __init__(self, base_dir, task_id, task_dir, watch_files=False, server_url="http://localhost:24337", reasoning_effort=None, thinking_tokens=None, confirm_before_edit=False):
    self.base_dir = base_dir
    self.task_id = task_id
    self.task_dir = task_dir
    self.server_url = server_url
    self.reasoning_effort = reasoning_effort
    self.thinking_tokens = thinking_tokens
    self.confirm_before_edit = confirm_before_edit
    self.models_info = None
    self._initialized = False

    try:
      self.loop = asyncio.get_event_loop()
    except RuntimeError:
      self.loop = asyncio.new_event_loop()
      asyncio.set_event_loop(self.loop)

    # Create initial coder for setup and non-prompt operations
    self.coder = create_base_coder(self)
    if reasoning_effort is not None:
      self.coder.main_model.set_reasoning_effort(reasoning_effort)
    if thinking_tokens is not None:
      self.coder.main_model.set_thinking_tokens(thinking_tokens)

    self.coder.pretty = False
    self.monkey_patch_coder_functions(self.coder)

    create_io(self, self.coder)

    # Initialize prompt executor
    self.prompt_executor = PromptExecutor(self)

    self.current_tokenization_task = None

    if watch_files:
      ignores = []
      if self.coder.root:
        ignores.append(self.coder.root + "/.gitignore")
      if self.coder.repo and self.coder.repo.aider_ignore_file:
        ignores.append(self.coder.repo.aider_ignore_file)

      self.file_watcher = FileWatcher(self.coder, gitignores=ignores)
      self.file_watcher.start()

    self.sio = socketio.AsyncClient()
    self.register_events()

  def monkey_patch_coder_functions(self, coder, prompt_context=None):
    # self here is the Connector instance
    # coder is the Coder instance

    original_lint_edited = coder.lint_edited
    def _patched_lint_edited(coder_instance, fnames):
      # Add loading message before linting
      wait_for_async(self, self.send_log_message("loading", "Linting...", False, prompt_context))
      # Call the original Coder.lint_edited logic
      result = original_lint_edited(fnames)
      # Finish the loading message after linting
      wait_for_async(self, self.send_log_message("loading", "Linting...", True, prompt_context))
      return result

    # Replace the original lint_edited method with the patched version
    coder.lint_edited = types.MethodType(_patched_lint_edited, coder)

    if self.confirm_before_edit:
      # Monkey patch prepare_to_edit to add confirmation if enabled
      original_prepare_to_edit = coder.prepare_to_edit
      def _patched_prepare_to_edit(coder_instance, edits):
        if len(edits) > 0:
          if coder.io.confirm_ask("Do you accept the changes?"):
            return original_prepare_to_edit(edits)
          else:
            coder.io.tool_output("Changes have been rejected.")
            return []
        else:
          return original_prepare_to_edit(edits)

      # Replace the original prepare_to_edit method with the patched version
      coder.prepare_to_edit = types.MethodType(_patched_prepare_to_edit, coder)

    original_cmd_test = coder.commands.cmd_test
    def _patched_cmd_test(coder_commands_instance, args):
      # self here is the Connector instance
      # coder_commands_instance is the Commands instance (coder.commands)
      coder.io.running_shell_command = True
      coder.io.tool_output("Running " + args if args else "Running " + self.coder.test_cmd)
      try:
        result = original_cmd_test(args)
      finally:
        coder.io.running_shell_command = False
      return result

    # Replace the original run_test method with the patched version
    coder.commands.cmd_test = types.MethodType(_patched_cmd_test, coder.commands)

    # Initialize command_outputs list if it doesn't exist
    if not hasattr(coder, 'command_outputs'):
      coder.command_outputs = []

    original_run_shell_commands = coder.run_shell_commands
    def _patched_run_shell_commands(coder_instance):
      # Call the original run_shell_commands method
      result = original_run_shell_commands()
      # Store the result in command_outputs list
      if result:
        coder.command_outputs.append(result)
      return result

    # Replace the original run_shell_commands method with the patched version
    coder.run_shell_commands = types.MethodType(_patched_run_shell_commands, coder)

  def monkey_patch_repo_functions(self, repo, prompt_context=None):
    if not repo:
      return

    # patch repo.get_commit_message to send a loading message while generating commit message
    original_get_commit_message = repo.get_commit_message

    def _patched_get_commit_message(repo_instance, diffs, context, user_language=None):
      wait_for_async(self, self.send_log_message("loading", "Generating commit message...", False, prompt_context))
      result = original_get_commit_message(diffs, context, user_language)
      wait_for_async(self, self.send_log_message("loading", "Generating commit message...", True, prompt_context))

      return result

    repo.get_commit_message = types.MethodType(_patched_get_commit_message, repo)

  def register_events(self):
    @self.sio.event
    async def connect():
      await self.on_connect()

    @self.sio.event
    async def message(data):
      await self.on_message(data)

    @self.sio.event
    async def disconnect():
      await self.on_disconnect()

    @self.sio.event
    async def connect_error(error):
      sys.stderr.write(f"Connection error: {error}\n")

  async def on_connect(self):
    """Handle connection event."""
    # Guard against duplicate initialization (can happen if event fires and we also call explicitly)
    if self._initialized:
      return

    self._initialized = True
    self.coder.io.tool_output("---- AIDER CONNECTOR CONNECTED TO AIDER DESK ----")

    await self.send_action({
      "action": "init",
      "source": "aider",
      "baseDir": self.base_dir,
      "taskId": self.task_id,
      "listenTo": [
        "prompt",
        "answer-question",
        "set-models",
        "request-context-info",
        "run-command",
        "interrupt-response",
        "apply-edits",
        "update-env-vars",
        "update-models-info"
      ],
      "contextFiles": self.get_context_files(),
      "inputHistoryFile": self.coder.io.input_history_file
    })
    await self.send_current_models()

  def _tokenize_files_sync(self, root, rel_fnames, addable_rel_fnames, encoding, abs_read_only_fnames):
    """Synchronous helper function for file tokenization."""
    try:
      auto_completer = AutoCompleter(
        root=root,
        rel_fnames=rel_fnames,
        addable_rel_fnames=addable_rel_fnames,
        commands=None,
        encoding=encoding,
        abs_read_only_fnames=abs_read_only_fnames,
      )
      auto_completer.tokenize()
      # Return tokenized words
      return [word[0] if isinstance(word, tuple) else word for word in auto_completer.words]
    except Exception as e:
      self.coder.io.tool_error(f"Error during tokenization: {str(e)}")
      return []

  async def on_message(self, data):
    await asyncio.create_task(self.process_message(data))

  async def on_disconnect(self):
    """Handle disconnection event."""
    self.coder.io.tool_output("AIDER CONNECTOR DISCONNECTED FROM AIDER DESK")

    self._initialized = False

    # Shutdown prompt executor
    if self.prompt_executor:
      await self.prompt_executor.shutdown()

    if self.current_tokenization_task and not self.current_tokenization_task.done():
      self.current_tokenization_task.cancel()

  async def connect(self):
    """Connect to the server with retry logic."""
    max_retries = 10
    base_delay = 0.5  # Initial delay in seconds
    max_delay = 5.0   # Maximum delay in seconds

    for attempt in range(max_retries):
      try:
        # Reset initialized flag before each connection attempt
        # This ensures on_connect runs properly after reconnection
        self._initialized = False
        await self.sio.connect(self.server_url)
        # Explicitly call on_connect after successful connection
        # This ensures init message is sent even if the event handler doesn't fire
        # (which can happen on reconnection after namespace errors)
        await self.on_connect()
        return  # Connection successful
      except Exception as e:
        if attempt == max_retries - 1:
          # Last attempt failed, re-raise the exception
          raise

        # Calculate delay with exponential backoff
        delay = min(base_delay * (2 ** attempt), max_delay)
        sys.stderr.write(f"Connection refused by the server: {e}. Retrying in {delay:.1f}s... (attempt {attempt + 1}/{max_retries})\n")
        sys.stderr.flush()
        await asyncio.sleep(delay)

  async def wait(self):
    """Wait for events."""
    await self.sio.wait()

  async def start(self):
    await self.connect()
    await self.wait()

  async def send_action(self, action, with_delay = True):
    await self.sio.emit('message', action)
    if with_delay:
      await asyncio.sleep(0.01)

  async def send_log_message(self, level, message, finished=False, prompt_context=None):
    payload = {
      "level": level,
      "message": message,
      "finished": finished
    }

    if prompt_context:
      payload["promptContext"] = {
        "id": prompt_context.id,
        "group": prompt_context.group if hasattr(prompt_context, 'group') else None
      }

    await self.sio.emit("log", payload)
    await asyncio.sleep(0.01)

  async def process_message(self, message):
    """Process incoming message and return response"""
    try:
      action = message.get('action')

      if not action:
        return

      if action == "prompt":
        prompt = message.get('prompt')
        mode = message.get('mode')
        architect_model = message.get('architectModel')
        prompt_context_data = message.get('promptContext')
        messages = message.get('messages', [])
        files = message.get('files', [])
        options = message.get('options', {})

        if not prompt:
          return

        # Log the options with default values
        auto_approve = options.get('autoApprove', False)
        deny_commands = options.get('denyCommands', False)
        self.coder.io.tool_output(f"AiderRunOptions received: autoApprove={auto_approve}, denyCommands={deny_commands}")

        prompt_context = PromptContext(prompt_context_data.get('id'), prompt_context_data.get('group'), auto_approve, deny_commands)
        await self.prompt_executor.run_prompt(prompt, prompt_context, mode, architect_model, messages, files)

      elif action == "answer-question":
        global confirmation_result
        confirmation_result = message.get('answer')

      elif action == "set-models":
        try:
          main_model = message.get('mainModel')
          weak_model = message.get('weakModel')
          edit_format = message.get('editFormat')
          environment_variables = message.get('environmentVariables')
          if environment_variables:
            await self.update_environment_variables(environment_variables)

          if not main_model:
            return

          model = models.Model(main_model, weak_model=weak_model)

          if not edit_format:
            edit_format = "diff"

          model.set_reasoning_effort(self.coder.main_model.get_reasoning_effort())
          model.set_thinking_tokens(self.coder.main_model.get_thinking_tokens())

          self.coder = clone_coder(self, self.coder, main_model=model, edit_format=edit_format)
          if self.coder.repo:
            self.coder.repo.models = model.commit_message_models()

          await asyncio.to_thread(models.sanity_check_models, self.coder.io, model)

          for line in self.coder.get_announcements():
            self.coder.io.tool_output(line)

          await self.send_current_models()
        except Exception as e:
          self.coder.io.tool_error(f"Error setting models: {str(e)}")

      elif action == "run-command":
        command = message.get('command')
        messages = message.get('messages', [])
        files = message.get('files', [])
        if not command:
          return

        await self.run_command(command, messages, files)

      elif action == "interrupt-response":
        # Interrupt all active prompts
        self.coder.io.tool_output("INTERRUPTING ALL RESPONSES")
        await self.prompt_executor.interrupt_all_prompts()

      elif action == "apply-edits":
        edits = message.get('edits')
        if not edits:
          return

        edit_tuples = [(edit['path'], edit['original'], edit['updated']) for edit in edits]
        self.coder.apply_edits(edit_tuples)
        await self.send_log_message("info", "Files have been updated." if len(edits) > 1 else "File has been updated.")

      elif action == "update-env-vars":
        environment_variables = message.get('environmentVariables')
        if environment_variables:
          await self.update_environment_variables(environment_variables)

          main_model = models.Model(self.coder.main_model.name, weak_model=self.coder.main_model.weak_model.name)
          self.coder.main_model = main_model

      elif action == "update-models-info":
        models_info = message.get('modelsInfo')
        await self.handle_models_info_update(models_info)

      elif action == "request-context-info":
        messages = message.get('messages')
        files = message.get('files')
        await self.send_tokens_info(messages, files)
        await self.send_repo_map()
        await self.send_autocompletion(files)

    except Exception as e:
      import traceback
      traceback.print_exc()
      self.coder.io.tool_error(f"Exception in connector: {str(e)}")
      return

  async def update_environment_variables(self, environment_variables):
    """Update environment variables for the Aider process"""
    try:
      # Update the environment variables in the current process
      for key, value in environment_variables.items():
        if value is not None:
          os.environ[key] = str(value)
    except Exception as e:
      await self.send_log_message("error", f"Failed to update environment variables: {str(e)}")

  async def run_command(self, command, messages, files):
    command_coder = clone_coder(self, self.coder, messages=messages, files=files)
    command_coder.io = self.coder.io

    if command.strip() == "/map":
      repo_map = command_coder.repo_map.get_repo_map(set(), command_coder.get_all_abs_files()) if command_coder.repo_map else None
      if repo_map:
        await self.send_log_message("info", repo_map)
      else:
        await self.send_log_message("info", "No repo map available.")
      return
    elif command.startswith("/reasoning-effort"):
      parts = command.split()
      valid_values = ['high', 'medium', 'low', 'minimal', 'none']
      if len(parts) != 2 or parts[1] not in valid_values:
        await self.send_log_message("error", "Invalid reasoning effort value. Use '/reasoning-effort [high|medium|low|none]'.")
        return
      if parts[1] == "none":
        # Safely remove 'reasoning_effort' if it exists
        if self.coder.main_model.extra_params and "extra_body" in self.coder.main_model.extra_params:
          self.coder.main_model.extra_params["extra_body"].pop("reasoning_effort", None)
        self.reasoning_effort = None
        await self.send_current_models()
        return
      self.reasoning_effort = parts[1]

    if command.startswith("/test ") or command.startswith("/run "):
      command_coder.io.running_shell_command = True
      command_coder.io.tool_output("Running " + command.split(" ", 1)[1])
    elif command.startswith("/tokens"):
      command_coder.io.running_shell_command = True
      command_coder.io.tool_output("Running /tokens")
    elif command.startswith("/commit"):
      command_coder.io.processing_loading_message = True
      await self.send_log_message("loading", "Committing changes...")
    elif command.startswith("/reset") or command.startswith("/drop"):
      # for /reset and /drop, we only need to send the initial context files
      await self.send_update_context_files()
      return

    # run the command
    command_coder.commands.run(command)

    # reset flags
    command_coder.io.reset_state(False)

    if command.startswith("/map-refresh"):
      await self.send_log_message("info", "The repo map has been refreshed.")
      await self.send_repo_map()
    elif command.startswith("/reasoning-effort"):
      self.coder.commands.run(command)
      await self.send_current_models()
    elif command.startswith("/think-tokens"):
      self.coder.commands.run(command)
      if self.coder.main_model.get_raw_thinking_tokens() == 0:
        if self.coder.main_model.extra_params:
          self.coder.main_model.extra_params.pop("reasoning", None)
          self.coder.main_model.extra_params.pop("thinking", None)
        self.thinking_tokens = None
      await self.send_current_models()

  async def send_autocompletion(self, files):
    try:
      # Use all files from files parameter and convert to relative paths
      rel_fnames = []
      for f in files:
        file_path = f['path']
        # Convert to relative path if it's an absolute path
        if file_path.startswith(self.task_dir):
          relative_path = os.path.relpath(file_path, self.task_dir)
        elif file_path.startswith(self.base_dir):
          relative_path = os.path.relpath(file_path, self.base_dir)
        else:
          relative_path = file_path
        rel_fnames.append(relative_path)

      # Run tokenization in a separate thread
      if len(rel_fnames) > 0:
        # Cancel any previous tokenization task if it's still running
        if self.current_tokenization_task and not self.current_tokenization_task.done():
          self.current_tokenization_task.cancel()

        async def tokenize_and_send():
          try:
            tokenized_words = await asyncio.to_thread(
              self._tokenize_files_sync,
              self.task_dir,
              rel_fnames,
              [],
              self.coder.io.encoding,
              self.coder.abs_read_only_fnames
            )
            await self.send_action({
              "action": "update-autocompletion",
              "words": tokenized_words,
            })
          except asyncio.CancelledError:
            # Task was cancelled, do nothing.
            pass
          except Exception as e:
            self.coder.io.tool_error(f"Error during tokenization: {str(e)}")

        self.current_tokenization_task = asyncio.create_task(tokenize_and_send())

      # else: The initial message with just filenames is sufficient if too many files
    except Exception as e:
      self.coder.io.tool_error(f"Error in send_autocompletion: {str(e)}")
      await self.send_action({
        "action": "update-autocompletion",
        "words": [],
      })

  async def send_repo_map(self):
    if self.coder.repo_map:
      try:
        repo_map = self.coder.repo_map.get_repo_map(set(), self.coder.get_all_abs_files())
        if repo_map:
          # Remove the prefix before sending
          prefix = self.coder.gpt_prompts.repo_content_prefix
          if repo_map.startswith(prefix):
            repo_map = repo_map[len(prefix):]

          await self.send_action({
            "action": "update-repo-map",
            "repoMap": repo_map
          })
      except Exception as e:
        self.coder.io.tool_error(f"Error sending repo map: {str(e)}")

  def get_context_files(self, coder=None):
    if not coder:
      coder = self.coder

    def get_rel_fname(fname):
      try:
        return os.path.relpath(fname, self.task_dir)
      except ValueError:
        return fname

    editable_files = [get_rel_fname(fname) for fname in coder.abs_fnames]
    read_only_files = [get_rel_fname(fname) for fname in coder.abs_read_only_fnames]

    return [
      {"path": fname, "readOnly": False} for fname in editable_files
    ] + [
      {"path": fname, "readOnly": True} for fname in read_only_files
    ]

  async def send_add_context_message(self, role, content):
    await self.send_action({
      "action": "add-message",
      "role": role,
      "content": content
    })

  async def send_add_context_files(self, coder=None):
    context_files = self.get_context_files(coder)
    for file in context_files:
      await self.send_action({
        "action": "add-file",
        "path": file["path"],
        "readOnly": file["readOnly"]
      })

  async def send_update_context_files(self, coder=None):
    context_files = self.get_context_files(coder)
    await self.sio.emit("message", {
      "action": "update-context-files",
      "files": context_files
    })

  async def send_current_models(self):
    error = None
    info = self.coder.main_model.info

    if self.coder.main_model.missing_keys:
      error = "Missing keys for the model: " + ", ".join(self.coder.main_model.missing_keys)

    await self.send_action({
      "action": "set-models",
      "mainModel": self.coder.main_model.name,
      "weakModel": self.coder.main_model.weak_model.name,
      "reasoningEffort": self.coder.main_model.get_reasoning_effort() if self.coder.main_model.get_reasoning_effort() is not None else self.reasoning_effort,
      "thinkingTokens": self.coder.main_model.get_thinking_tokens() if self.coder.main_model.get_thinking_tokens() is not None else self.thinking_tokens,
      "editFormat": self.coder.edit_format,
      "info": info,
      "error": error
    })

  async def send_tokens_info(self, messages, files):
    cost_per_token = self.coder.main_model.info.get("input_cost_per_token") or 0
    info = {
      "files": {}
    }

    self.coder.choose_fence()

    # system messages
    main_sys = self.coder.fmt_system_prompt(self.coder.gpt_prompts.main_system)
    main_sys += "\n" + self.coder.fmt_system_prompt(self.coder.gpt_prompts.system_reminder)
    msgs = [
      dict(role="system", content=main_sys),
      dict(
        role="system",
        content=self.coder.fmt_system_prompt(self.coder.gpt_prompts.system_reminder),
      ),
    ]
    tokens = self.coder.main_model.token_count(msgs)
    info["systemMessages"] = {
      "tokens": tokens,
      "cost": tokens * cost_per_token,
    }

    # Convert messages to the format expected by token_count
    msgs = [dict(role=msg['role'], content=msg['content']) for msg in messages]

    if msgs:
      tokens = self.coder.main_model.token_count(msgs)
    else:
      tokens = 0
    info["chatHistory"] = {
      "tokens": tokens,
      "cost": tokens * cost_per_token,
    }

    # Convert context_files to absolute file paths like coder does
    abs_fnames = set()
    abs_read_only_fnames = set()

    for file in files:
      file_path = file['path']
      if not file_path.startswith(self.task_dir):
        file_path = os.path.join(self.task_dir, file_path)

      if file.get('readOnly', False):
        abs_read_only_fnames.add(file_path)
      else:
        abs_fnames.add(file_path)

    all_abs_files = self.coder.get_all_abs_files()
    other_files = set(all_abs_files) - abs_fnames

    if self.coder.repo_map:
      repo_content = self.coder.repo_map.get_repo_map(abs_fnames, other_files)
      if repo_content:
        tokens = self.coder.main_model.token_count(repo_content)
      else:
        tokens = 0
    else:
      tokens = 0
    info["repoMap"] = {
      "tokens": tokens,
      "cost": tokens * cost_per_token,
    }

    fence = "`" * 3

    # Process the provided context files
    for file in files:
      file_path = file['path']
      if not file_path.startswith(self.task_dir):
        file_path = os.path.join(self.task_dir, file_path)

      # Skip directories
      if os.path.isdir(file_path):
        continue

      relative_fname = self.coder.get_rel_fname(file_path)
      content = self.coder.io.read_text(file_path)
      if is_image_file(relative_fname):
        tokens = self.coder.main_model.token_count_for_image(file_path)
      elif content is not None:
        # approximate
        content = f"{relative_fname}\n{fence}\n" + content + "{fence}\n"
        tokens = self.coder.main_model.token_count(content)
      else:
        tokens = 0
      info["files"][relative_fname] = {
        "tokens": tokens,
        "cost": tokens * cost_per_token,
      }

    await self.send_action({
      "action": "tokens-info",
      "info": info
    })

  async def handle_models_info_update(self, models_info):
    """Handle models info update event"""
    self.coder.io.tool_output(f"Received models info update: {models_info}")
    self.models_info = models_info

    update_model_params(self.models_info, self.coder.main_model)
    if self.coder.main_model.weak_model:
      update_model_params(self.models_info, self.coder.main_model.weak_model)


def main(argv=None):
  try:
    if argv is None:
      argv = sys.argv[1:]

    # Parse command line arguments
    parser = argparse.ArgumentParser(description="AiderDesk Connector")
    parser.add_argument("--watch-files", action="store_true", help="Watch files for changes")
    parser.add_argument("--reasoning-effort", type=str, default=None, help="Set the reasoning effort for the model")
    parser.add_argument("--thinking-tokens", type=str, default=None, help="Set the thinking tokens for the model")

    args, _ = parser.parse_known_args(argv) # Use parse_known_args to ignore unknown args

    # Get environment variables
    server_url = os.getenv("CONNECTOR_SERVER_URL", "http://localhost:24337")
    base_dir = os.getenv("BASE_DIR", os.getcwd())
    task_id = os.getenv("TASK_ID", "default")
    task_dir = os.getenv("TASK_DIR", os.getcwd())
    confirm_before_edit = os.getenv("CONNECTOR_CONFIRM_BEFORE_EDIT", "0") == "1"

    # Telemetry
    setup_telemetry()

    # Create connector instance
    connector = Connector(
      base_dir,
      task_id,
      task_dir,
      watch_files=args.watch_files,
      server_url=server_url,
      reasoning_effort=args.reasoning_effort,
      thinking_tokens=args.thinking_tokens,
      confirm_before_edit=confirm_before_edit
    )

    # Start the connector
    asyncio.run(connector.start())

  except argparse.ArgumentError as e:
    sys.stderr.write(f"Argument parsing error: {str(e)}\n")
    sys.exit(1)
  except ValueError as e:
    sys.stderr.write(f"Configuration error: {str(e)}\n")
    sys.exit(2)
  except ConnectionError as e:
    sys.stderr.write(f"Connection error: {str(e)}\n")
    sys.exit(3)
  except Exception as e:
    sys.stderr.write(f"Unexpected error: {str(e)}\n")
    sys.exit(4)

def setup_telemetry():
  langfuse_public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
  langfuse_secret_key = os.getenv("LANGFUSE_SECRET_KEY")
  langfuse_host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")

  if langfuse_public_key and langfuse_secret_key:
    os.environ["LANGFUSE_PUBLIC_KEY"] = langfuse_public_key
    os.environ["LANGFUSE_SECRET_KEY"] = langfuse_secret_key
    os.environ["LANGFUSE_HOST"] = langfuse_host
    litellm.callbacks = ["langfuse_otel"]

  # Set OpenRouter site and app name
  os.environ["OR_SITE_URL"] = 'https://aiderdesk.hotovo.com'
  os.environ["OR_APP_NAME"] = 'AiderDesk'
  os.environ["LITELLM_LOG"] = "DEBUG"

if __name__ == "__main__":
  main()
