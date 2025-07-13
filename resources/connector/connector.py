#!/usr/bin/env python

import argparse
import os
import sys
import asyncio
import json
import socketio
import tempfile
from aider import models
from aider.coders import Coder
from aider.io import InputOutput, AutoCompleter
from aider.watch import FileWatcher
from aider.main import main as cli_main
from aider.utils import is_image_file
from concurrent.futures import ThreadPoolExecutor
import nest_asyncio
import types
nest_asyncio.apply()

confirmation_result = None
whole_content = ""

def wait_for_async(connector, coroutine):
  try:
    task = connector.loop.create_task(coroutine)
    result = connector.loop.run_until_complete(task)
    return result
  except Exception as e:
    connector.coder.io.tool_output(f'EXCEPTION: {e}')
    return None

async def run_editor_coder_stream(architect_coder, connector):
  # Use the editor_model from the main_model if it exists, otherwise use the main_model itself
  editor_model = architect_coder.main_model.editor_model or architect_coder.main_model

  kwargs = dict()
  kwargs["main_model"] = editor_model
  kwargs["edit_format"] = architect_coder.main_model.editor_edit_format
  kwargs["suggest_shell_commands"] = False
  kwargs["map_tokens"] = 0
  kwargs["total_cost"] = architect_coder.total_cost
  kwargs["cache_prompts"] = False
  kwargs["num_cache_warming_pings"] = 0
  kwargs["summarize_from_coder"] = False

  new_kwargs = dict(io=architect_coder.io, from_coder=architect_coder)
  new_kwargs.update(kwargs)

  editor_coder = Coder.create(**new_kwargs)
  editor_coder.cur_messages = []
  editor_coder.done_messages = []
  connector.monkey_patch_coder_functions(editor_coder)

  global whole_content
  if not whole_content:
    whole_content = architect_coder.partial_response_content

  await connector.sio.emit('message', {
    "action": "response",
    "finished": True,
    "content": whole_content
  })

  whole_content = ""
  # run the editor coder
  for chunk in editor_coder.run_stream(architect_coder.partial_response_content):
    # add small sleeps here to allow other coroutines to run
    await connector.sio.emit('message', {
      "action": "response",
      "finished": False,
      "content": chunk
    })
    whole_content += chunk
    await asyncio.sleep(0.01)

  # set values back to the architect coder
  architect_coder.move_back_cur_messages("I made those changes to the files.")
  architect_coder.total_cost = editor_coder.total_cost
  architect_coder.aider_commit_hashes = editor_coder.aider_commit_hashes

class ConnectorInputOutput(InputOutput):
  def __init__(self, connector=None, **kwargs):
    super().__init__(**kwargs)
    self.connector = connector
    self.running_shell_command = False
    self.processing_loading_message = False
    self.current_command = None

  def add_to_input_history(self, input_text):
    # handled by AiderDesk
    pass

  def tool_output(self, *messages, log_only=False, bold=False):
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
            await asyncio.sleep(0.1)

          self.current_command = message[8:]
          wait_for_async(self.connector, send_use_command_output())
    else:
      for message in messages:
        if message.startswith("Commit "):
          wait_for_async(self.connector, self.connector.send_log_message("info", message, True))

  def is_warning_ignored(self, message):
    if message == "Warning: it's best to only add files that need changes to the chat.":
      return True
    if message == "https://aider.chat/docs/troubleshooting/edit-errors.html":
      return True
    return False

  def tool_warning(self, message="", strip=True):
    super().tool_warning(message, strip)
    if self.connector and not self.is_warning_ignored(message):
      wait_for_async(self.connector, self.connector.send_log_message("warning", message, self.processing_loading_message))

  def is_error_ignored(self, message):
    if message.endswith("is already in the chat as a read-only file"):
      return True
    if message.endswith("is already in the chat as an editable file"):
      return True

    return False

  def tool_error(self, message="", strip=True):
    super().tool_error(message, strip)
    if self.connector and not self.is_error_ignored(message):
      wait_for_async(self.connector, self.connector.send_log_message("error", message))

  def confirm_ask(
    self,
    question,
    default="y",
    subject=None,
    explicit_yes_required=False,
    group=None,
    allow_never=False,
  ):
    if group and group.preference == "y":
      return True
    elif group and group.preference == "n":
      self.tool_warning("No preference.")
      return False

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
        await asyncio.sleep(1)
      return confirmation_result

    result = wait_for_async(self.connector, ask_question())

    if result == "y" and self.connector.running_coder and question == "Edit the files?":
      # Process architect coder
      wait_for_async(self.connector, self.connector.send_log_message("loading", "Editing files..."))
      wait_for_async(self.connector, run_editor_coder_stream(self.connector.running_coder, self.connector))
      return False

    if result == "y" and question.startswith("Run shell command"):
      self.running_shell_command = True
      self.current_command = None
    if question == "Add command output to the chat?":
      self.reset_state()

    if result == "a" and group is not None:
      group.preference = "y"
      self.tool_warning("Always preference.")
    elif result == "s" and group is not None:
      group.preference = "n"
      self.tool_warning("Never preference.")

    return result == "y" or result == "a"

  def reset_state(self):
    if (self.current_command):
      wait_for_async(self.connector, self.connector.send_action({
        "action": "use-command-output",
        "command": self.current_command,
        "finished": True
      }))

      self.running_shell_command = False
      self.current_command = None

  def interrupt_input(self):
    async def process_changes():
      await self.connector.run_prompt(prompt)
      await self.connector.send_update_context_files()
      self.connector.file_watcher.start()

    if self.connector.file_watcher:
      prompt = self.connector.file_watcher.process_changes()
      if prompt:
        changed_files = ", ".join(sorted(self.connector.file_watcher.changed_files))
        wait_for_async(self.connector, self.connector.send_log_message("info", f"Detected AI request in files: {changed_files}."))
        wait_for_async(self.connector, self.connector.send_log_message("loading", "Processing request..."))
        self.connector.loop.create_task(process_changes())

def create_coder(connector):
  coder = cli_main(return_coder=True)
  if not isinstance(coder, Coder):
    raise ValueError(coder)
  if not coder.repo:
    raise ValueError("WebsocketConnector can currently only be used inside a git repo")

  io = ConnectorInputOutput(
    connector=connector,
    pretty=False,
    yes=None,
    input_history_file=coder.io.input_history_file,
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
  coder.repo.io = io

  return coder

class Connector:
  def __init__(self, base_dir, watch_files=False, server_url="http://localhost:24337", reasoning_effort=None, thinking_tokens=None):
    self.base_dir = base_dir
    self.server_url = server_url
    self.reasoning_effort = reasoning_effort
    self.thinking_tokens = thinking_tokens

    self.coder = create_coder(self)
    if reasoning_effort is not None:
      self.coder.main_model.set_reasoning_effort(reasoning_effort)
    if thinking_tokens is not None:
      self.coder.main_model.set_thinking_tokens(thinking_tokens)

    self.coder.yield_stream = True
    self.coder.stream = True
    self.coder.pretty = False
    self.monkey_patch_coder_functions(self.coder)
    self.running_coder = None
    self.interrupted = False
    self.current_tokenization_future = None
    self.tokenization_executor = None

    if watch_files:
      ignores = []
      if self.coder.root:
        ignores.append(self.coder.root + "/.gitignore")
      if self.coder.repo.aider_ignore_file:
        ignores.append(self.coder.repo.aider_ignore_file)

      self.file_watcher = FileWatcher(self.coder, gitignores=ignores)
      self.file_watcher.start()

    try:
      self.loop = asyncio.get_event_loop()
    except RuntimeError:
      self.loop = asyncio.new_event_loop()
      asyncio.set_event_loop(self.loop)

    self.sio = socketio.AsyncClient()
    self._register_events()

  def monkey_patch_coder_functions(self, coder):
    # self here is the Connector instance
    # coder is the Coder instance

    original_lint_edited = coder.lint_edited
    def _patched_lint_edited(coder_instance, fnames):
        # Add loading message before linting
        wait_for_async(self, self.send_log_message("loading", "Linting..."))
        # Call the original Coder.lint_edited logic
        result = original_lint_edited(fnames)
        # Finish the loading message after linting
        wait_for_async(self, self.send_log_message("loading", "Linting...", True))
        return result

    # Replace the original lint_edited method with the patched version
    coder.lint_edited = types.MethodType(_patched_lint_edited, coder)

    original_cmd_test = coder.commands.cmd_test
    def _patched_cmd_test(coder_commands_instance, args):
        # self here is the Connector instance
        # coder_commands_instance is the Commands instance (coder.commands)
        self.coder.io.running_shell_command = True
        self.coder.io.tool_output("Running " + args if args else "Running " + self.coder.test_cmd)
        try:
            result = original_cmd_test(args)
        finally:
            self.coder.io.running_shell_command = False
        return result

    # Replace the original run_test method with the patched version
    coder.commands.cmd_test = types.MethodType(_patched_cmd_test, coder.commands)

  def get_tokenization_executor(self):
    if self.tokenization_executor is None:
      self.tokenization_executor = ThreadPoolExecutor(max_workers=2)
    return self.tokenization_executor

  def _register_events(self):
    @self.sio.event
    async def connect():
      await self.on_connect()

    @self.sio.on("message")
    async def on_message(data):
      await self.on_message(data)

    @self.sio.event
    async def disconnect():
      await self.on_disconnect()

  async def on_connect(self):
    """Handle connection event."""
    self.coder.io.tool_output("CONNECTED TO SERVER")
    await self.send_action({
      'action': 'init',
      'baseDir': self.base_dir,
      'listenTo': [
        'prompt',
        'add-file',
        'set-files',
        'drop-file',
        'answer-question',
        'set-models',
        'run-command',
        'add-message',
        'interrupt-response',
        'apply-edits',
        'update-env-vars'
      ],
      'inputHistoryFile': self.coder.io.input_history_file
    })
    await self.send_update_context_files()
    await self.send_current_models()
    await self.send_repo_map()
    await self.send_autocompletion()

  async def _send_tokenized_autocompletion(self, tokenized_words, initial_words, all_relative_files, all_models):
    """Sends the final autocompletion message after tokenization."""
    try:
      # Combine initial words with tokenized words
      final_words = initial_words + tokenized_words

      # Send the final list of words
      await self.sio.emit("message", {
        "action": "update-autocompletion",
        "words": final_words,
        "allFiles": all_relative_files,
        "models": all_models
      })
    except Exception as e:
      self.coder.io.tool_error(f"Error sending tokenized autocompletion: {str(e)}")

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
    await self.process_message(data)

  async def on_disconnect(self):
    """Handle disconnection event."""
    self.coder.io.tool_output("DISCONNECTED FROM SERVER")

    tokenization_executor = self.tokenization_executor
    self.tokenization_executor = None
    if tokenization_executor:
      # Shutdown the executor if it was created
      tokenization_executor.shutdown(wait=True, cancel_futures=True)

  async def connect(self):
    """Connect to the server."""
    await self.sio.connect(self.server_url)

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

  async def send_log_message(self, level, message, finished=False):
    await self.sio.emit("log", {
      'level': level,
      'message': message,
      'finished': finished
    })
    await asyncio.sleep(0.01)

  async def process_message(self, message):
    """Process incoming message and return response"""
    try:
      action = message.get('action')

      if not action:
        return json.dumps({"error": "No action specified"})

      self.reset_before_action()

      if action == "prompt":
        prompt = message.get('prompt')
        mode = message.get('mode')
        architect_model = message.get('architectModel')
        prompt_id = message.get('promptId')
        clear_context = message.get('clearContext')
        clear_files = message.get('clearFiles')

        if not prompt:
          return json.dumps({"success": True})

        try:
            await self.run_prompt(prompt, mode, architect_model, prompt_id, clear_context, clear_files)
        finally:
            if prompt_id:
                await self.send_action({
                    "action": "prompt-finished",
                    "promptId": prompt_id
                })

      elif action == "answer-question":
        global confirmation_result
        confirmation_result = message.get('answer')

      elif action == "add-file":
        path = message.get('path')
        if not path:
          return

        read_only = message.get('readOnly')
        no_update = message.get('noUpdate')

        await self.add_file(path, read_only, no_update)

      elif action == "drop-file":
        path = message.get('path')
        if not path:
          return

        no_update = message.get('noUpdate')

        await self.drop_file(path, no_update)

      elif action == "set-models":
        main_model = message.get('mainModel')
        weak_model = message.get('weakModel')
        edit_format = message.get('editFormat')
        if not main_model:
          return

        model = models.Model(main_model, weak_model=weak_model)
        models.sanity_check_models(self.coder.io, model)

        if not edit_format:
          edit_format = model.edit_format

        model.set_reasoning_effort(self.coder.main_model.get_reasoning_effort())
        model.set_thinking_tokens(self.coder.main_model.get_thinking_tokens())

        self.coder = Coder.create(
          from_coder=self.coder,
          main_model=model,
          edit_format=edit_format,
          summarize_from_coder=False
        )
        self.monkey_patch_coder_functions(self.coder)
        for line in self.coder.get_announcements():
          self.coder.io.tool_output(line)
        await self.send_current_models()
        await self.send_tokens_info()

      elif action == "run-command":
        command = message.get('command')
        if not command:
          return

        await self.run_command(command)

      elif action == "add-message":
        content = message.get('content')
        if not content:
          return

        role = message.get('role', 'user')
        acknowledge = message.get('acknowledge', True)

        self.coder.done_messages += [
          dict(role=role, content=content)
        ]
        if role == "user" and acknowledge:
          self.coder.done_messages += [
            dict(role="assistant", content="Ok."),
          ]
        await self.send_tokens_info()

      elif action == "interrupt-response":
        self.interrupted = True
        self.coder.io.tool_output("INTERRUPTING RESPONSE")

      elif action == "apply-edits":
        edits = message.get('edits')
        if not edits:
          return

        edit_tuples = [(edit['path'], edit['original'], edit['updated']) for edit in edits]
        self.coder.apply_edits(edit_tuples)
        await self.send_log_message("info", "Files have been updated." if len(edits) > 1 else "File has been updated.")
        await self.send_update_context_files()
        await self.send_tokens_info()

      elif action == "update-env-vars":
        environment_variables = message.get('environmentVariables')
        if environment_variables:
          await self.update_environment_variables(environment_variables)

          main_model = models.Model(self.coder.main_model.name, weak_model=self.coder.main_model.weak_model.name)
          self.coder.main_model = main_model

      else:
        return json.dumps({
          "error": f"Unknown action: {action}"
        })

      return json.dumps({"success": True})
    except Exception as e:
      self.coder.io.tool_error(f"Exception in connector: {str(e)}")
      return json.dumps({
        "error": str(e)
      })

  def reset_before_action(self):
    self.coder.io.reset_state()
    self.interrupted = False

  async def run_prompt(self, prompt, mode=None, architect_model=None, prompt_id=None, clear_context=False, clear_files=False):
    self.coder.io.add_to_input_history(prompt)

    coder_model = self.coder.main_model

    if (mode and mode != "code") or clear_context or clear_files:
      running_model = self.coder.main_model
      if mode == "architect" and architect_model:
        running_model = models.Model(architect_model, weak_model=coder_model.weak_model.name, editor_model=coder_model.name)
        models.sanity_check_models(self.coder.io, running_model)

      self.running_coder = Coder.create(
        from_coder=self.coder,
        edit_format=mode,
        main_model=running_model,
        summarize_from_coder=False,
      )
      self.monkey_patch_coder_functions(self.running_coder)

      if clear_context:
        self.running_coder.cur_messages = []
        self.running_coder.done_messages = []

      if clear_files:
        self.running_coder.abs_fnames = []
        self.running_coder.abs_read_only_fnames = []

      # we need to disable auto accept as this does not work properly with AiderDesk
      self.running_coder.auto_accept_architect=False
    else:
      self.running_coder = self.coder

    # setting usage report to None to avoid no attribute error
    self.running_coder.usage_report = None

    global whole_content
    whole_content = ""

    async def run_stream_async():
      try:
        for chunk in self.running_coder.run_stream(prompt):
          # add small sleeps here to allow other coroutines to run
          await asyncio.sleep(0.01)
          if self.interrupted:
            break
          else:
            yield chunk
      except Exception as e:
        self.coder.io.tool_error(str(e))

    async for chunk in run_stream_async():
      whole_content += chunk
      await self.send_action({
        "action": "response",
        "finished": False,
        "content": chunk
      }, False)

    if not whole_content:
      # if there was no content, use the partial_response_content value (case for non streaming models)
      whole_content = self.running_coder.partial_response_content

    # Send final response with complete data
    response_data = {
      "action": "response",
      "content": whole_content,
      "finished": True,
      "editedFiles": list(self.running_coder.aider_edited_files),
      "usageReport": self.running_coder.usage_report
    }

    # Add commit info if there was one
    if self.running_coder.last_aider_commit_hash:
      response_data.update({
        "commitHash": self.running_coder.last_aider_commit_hash,
        "commitMessage": self.running_coder.last_aider_commit_message,
      })
      # Add diff if there was a commit
      commits = f"{self.running_coder.last_aider_commit_hash}~1"
      diff = self.running_coder.repo.diff_commits(
        self.running_coder.pretty,
        commits,
        self.running_coder.last_aider_commit_hash,
      )
      response_data["diff"] = diff
    await self.send_action(response_data)

    if self.interrupted:
      self.running_coder.cur_messages += [dict(role="assistant", content=whole_content + " (interrupted)")]

    if self.running_coder != self.coder:
      cur_messages = self.coder.cur_messages if clear_context else self.running_coder.cur_messages
      done_messages = self.coder.done_messages if clear_context else self.running_coder.done_messages

      self.coder = Coder.create(
        edit_format=self.coder.edit_format,
        summarize_from_coder=False,
        main_model=coder_model,
        from_coder=self.running_coder,
        cur_messages=cur_messages,
        done_messages=done_messages,
      )
      self.monkey_patch_coder_functions(self.coder)

    await self.send_update_context_files()

    # Check for reflections
    if self.running_coder.reflected_message:
      current_reflection = 0
      while self.running_coder.reflected_message and not self.interrupted:
        if current_reflection >= self.coder.max_reflections:
          self.coder.io.tool_warning(f"Only {str(self.coder.max_reflections)} reflections allowed, stopping.")
          break

        prompt = self.running_coder.reflected_message
        await self.send_log_message("loading", "Reflecting message...")

        # use default coder to run the reflection
        self.running_coder = self.coder
        whole_content = ""
        async for chunk in run_stream_async():
          whole_content += chunk
          await self.send_action({
            "action": "response",
            "reflectedMessage": prompt,
            "finished": False,
            "content": chunk
          }, False)

        response_data = {
          "action": "response",
          "content": whole_content,
          "reflected_message": prompt,
          "finished": True,
          "editedFiles": list(self.running_coder.aider_edited_files),
          "usageReport": self.running_coder.usage_report
        }

        await self.send_action(response_data)

        if self.interrupted:
          self.running_coder.cur_messages += [dict(role="assistant", content=whole_content + " (interrupted)")]

        await self.send_update_context_files()
        current_reflection += 1

    self.running_coder = None
    await self.send_tokens_info()
    await self.send_repo_map()
    await self.send_autocompletion()

    # Send prompt-finished message if we have a prompt ID
    if prompt_id:
      await self.send_action({
        "action": "prompt-finished",
        "promptId": prompt_id
      })

  async def update_environment_variables(self, environment_variables):
    """Update environment variables for the Aider process"""
    try:
      # Update the environment variables in the current process
      for key, value in environment_variables.items():
        if value is not None:
          os.environ[key] = str(value)
    except Exception as e:
      await self.send_log_message("error", f"Failed to update environment variables: {str(e)}")

  async def add_file(self, path, read_only, no_update=False):
    """Add a file to the coder's tracked files"""
    if read_only:
      self.coder.commands.cmd_read_only("\"" + path + "\"")
    else:
      self.coder.commands.cmd_add("\"" + path + "\"")

    if not no_update:
      await self.send_update_context_files()
      await self.send_tokens_info()
      await self.send_autocompletion()

  async def drop_file(self, path, no_update=False):
    """Drop a file from the coder's tracked files"""
    self.coder.commands.cmd_drop("\"" + path + "\"")

    if not no_update:
      await self.send_update_context_files()
      await self.send_tokens_info()
      await self.send_autocompletion()

  async def run_command(self, command):
    if command.startswith("/map"):
      repo_map = self.coder.repo_map.get_repo_map(set(), self.coder.get_all_abs_files()) if self.coder.repo_map else None
      await asyncio.sleep(0.1)
      if repo_map:
        await self.send_log_message("info", repo_map)
      else:
        await self.send_log_message("info", "No repo map available.")
      return
    elif command.startswith("/reasoning-effort"):
      parts = command.split()
      valid_values = ['high', 'medium', 'low', 'none']
      if len(parts) != 2 or parts[1] not in valid_values:
        await self.send_log_message("error", "Invalid reasoning effort value. Use '/reasoning-effort [high|medium|low|none]'.")
        return
      if parts[1] == "none":
        # Safely remove 'reasoning_effort' if it exists
        if self.coder.main_model.extra_params and "extra_body" in self.coder.main_model.extra_params:
            self.coder.main_model.extra_params["extra_body"].pop("reasoning_effort", None)
        self.reasoning_effort = None
        await asyncio.sleep(0.1)
        await self.send_current_models()
        return
      self.reasoning_effort = parts[1]

    if command.startswith("/test ") or command.startswith("/run "):
      self.coder.io.running_shell_command = True
      self.coder.io.tool_output("Running " + command.split(" ", 1)[1])
    elif command.startswith("/tokens"):
      self.coder.io.running_shell_command = True
      self.coder.io.tool_output("Running /tokens")
    elif command.startswith("/commit"):
      self.coder.io.processing_loading_message = True
      await self.send_log_message("loading", "Committing changes...")

    if command.startswith("/paste"):
      original_mkdtemp = tempfile.mkdtemp
      tmp_dir = os.path.join(self.base_dir, '.aider-desk', 'tmp')
      os.makedirs(tmp_dir, exist_ok=True)

      def patched_mkdtemp(*args, **kwargs):
        kwargs['dir'] = tmp_dir
        return original_mkdtemp(*args, **kwargs)

      tempfile.mkdtemp = patched_mkdtemp

      try:
        self.coder.commands.run(command)
      finally:
        tempfile.mkdtemp = original_mkdtemp
    else:
      self.coder.commands.run(command)

    self.coder.io.running_shell_command = False
    self.coder.io.processing_loading_message = False
    if command.startswith("/paste"):
      await asyncio.sleep(0.1)
      await self.send_update_context_files()
    elif command.startswith("/clear"):
      await asyncio.sleep(0.1)
      await self.send_tokens_info()
    elif command.startswith("/map-refresh"):
      await asyncio.sleep(0.1)
      await self.send_log_message("info", "The repo map has been refreshed.")
      await self.send_repo_map()
      await self.send_autocompletion()
    elif command.startswith("/reasoning-effort"):
      await asyncio.sleep(0.1)
      await self.send_current_models()
    elif command.startswith("/think-tokens"):
      self.coder.commands.run(command)
      if self.coder.main_model.get_raw_thinking_tokens() == 0:
        if self.coder.main_model.extra_params:
          self.coder.main_model.extra_params.pop("reasoning", None)
          self.coder.main_model.extra_params.pop("thinking", None)
        self.thinking_tokens = None
      await asyncio.sleep(0.1)
      await self.send_current_models()
    elif command.startswith("/reset") or command.startswith("/drop"):
      await self.send_update_context_files()
      await self.send_autocompletion()
      await self.send_tokens_info()

  async def send_autocompletion(self):
    if not self.sio:
      return
    try:
      inchat_files = self.coder.get_inchat_relative_files()
      read_only_files = [self.coder.get_rel_fname(fname) for fname in self.coder.abs_read_only_fnames]
      rel_fnames = sorted(set(inchat_files + read_only_files))
      all_relative_files = self.coder.get_all_relative_files()
      all_models = sorted(set(models.fuzzy_match_models("") + [model_settings.name for model_settings in models.MODEL_SETTINGS]))

      # Initialize words with just the filenames and send immediately
      initial_words = [fname.split('/')[-1] for fname in rel_fnames]
      await self.sio.emit("message", {
        "action": "update-autocompletion",
        "words": initial_words,
        "allFiles": all_relative_files,
        "models": all_models
      })
      await asyncio.sleep(0.01) # Allow message to send

      # Run tokenization in a separate thread
      if len(rel_fnames) > 0:
        # Cancel any previous tokenization task if it's still running
        if self.current_tokenization_future and not self.current_tokenization_future.done():
          self.current_tokenization_future.cancel()

        # Schedule the synchronous tokenization function in an executor
        self.current_tokenization_future = self.loop.run_in_executor(
            self.get_tokenization_executor(),
            self._tokenize_files_sync,
            self.coder.root,
            rel_fnames,
            self.coder.get_addable_relative_files(),
            self.coder.io.encoding,
            self.coder.abs_read_only_fnames
        )

        # Define a callback to handle the result of the tokenization
        def _on_tokenization_complete(future):
          if future.cancelled():
            return  # Do nothing if the task was cancelled
          try:
            tokenized_words = future.result()
            # Schedule the sending of the final autocompletion message
            self.loop.create_task(
              self._send_tokenized_autocompletion(
                tokenized_words, initial_words, all_relative_files, all_models
              )
            )
          except Exception as e:
            self.coder.io.tool_error(f"Error retrieving tokenization result: {str(e)}")

        # Add the callback to the future
        self.current_tokenization_future.add_done_callback(_on_tokenization_complete)

      # else: The initial message with just filenames is sufficient if too many files
    except Exception as e:
      self.coder.io.tool_error(f"Error in send_autocompletion: {str(e)}")
      await self.sio.emit("message", {
        "action": "update-autocompletion",
        "words": [],
        "allFiles": [],
        "models": sorted(set(models.fuzzy_match_models("") + [model_settings.name for model_settings in models.MODEL_SETTINGS]))
      })

  async def send_repo_map(self):
    if self.sio and self.coder.repo_map:
      try:
        repo_map = self.coder.repo_map.get_repo_map(set(), self.coder.get_all_abs_files())
        if repo_map:
          # Remove the prefix before sending
          prefix = self.coder.gpt_prompts.repo_content_prefix
          if repo_map.startswith(prefix):
              repo_map = repo_map[len(prefix):]

          await self.sio.emit("message", {
            "action": "update-repo-map",
            "repoMap": repo_map
          })
      except Exception as e:
        self.coder.io.tool_error(f"Error sending repo map: {str(e)}")


  async def send_update_context_files(self):
    if self.sio:
      inchat_files = self.coder.get_inchat_relative_files()
      read_only_files = [self.coder.get_rel_fname(fname) for fname in self.coder.abs_read_only_fnames]

      context_files = [
                        {"path": fname, "readOnly": False} for fname in inchat_files
                      ] + [
                        {"path": fname, "readOnly": True} for fname in read_only_files
                      ]

      await self.sio.emit("message", {
        "action": "update-context-files",
        "files": context_files
      })
      await asyncio.sleep(0.01)

  async def send_current_models(self):
    if self.sio:
      error = None
      info = self.coder.main_model.info

      if self.coder.main_model.missing_keys:
        error = "Missing keys for the model: " + ", ".join(self.coder.main_model.missing_keys)

      await self.sio.emit("message", {
        "action": "set-models",
        "mainModel": self.coder.main_model.name,
        "weakModel": self.coder.main_model.weak_model.name,
        "reasoningEffort": self.coder.main_model.get_reasoning_effort() if self.coder.main_model.get_reasoning_effort() is not None else self.reasoning_effort,
        "thinkingTokens": self.coder.main_model.get_thinking_tokens() if self.coder.main_model.get_thinking_tokens() is not None else self.thinking_tokens,
        "editFormat": self.coder.edit_format,
        "info": info,
        "error": error
      })

  async def send_tokens_info(self):
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

    # chat history
    msgs = self.coder.done_messages + self.coder.cur_messages
    if msgs:
      tokens = self.coder.main_model.token_count(msgs)
    else:
      tokens = 0
    info["chatHistory"] = {
      "tokens": tokens,
      "cost": tokens * cost_per_token,
    }

    # repo map
    other_files = set(self.coder.get_all_abs_files()) - set(self.coder.abs_fnames)
    if self.coder.repo_map:
      repo_content = self.coder.repo_map.get_repo_map(self.coder.abs_fnames, other_files)
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

    # files
    for fname in self.coder.abs_fnames:
      relative_fname = self.coder.get_rel_fname(fname)
      content = self.coder.io.read_text(fname)
      if is_image_file(relative_fname):
        tokens = self.coder.main_model.token_count_for_image(fname)
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

    # read-only files
    for fname in self.coder.abs_read_only_fnames:
      relative_fname = self.coder.get_rel_fname(fname)
      content = self.coder.io.read_text(fname)
      if content is not None and not is_image_file(relative_fname):
        # approximate
        content = f"{relative_fname}\n{fence}\n" + content + "{fence}\n"
        tokens = self.coder.main_model.token_count(content)
        info["files"][relative_fname] = {
          "tokens": tokens,
          "cost": tokens * cost_per_token,
        }

    if self.sio:
      await self.sio.emit("message", {
        "action": "tokens-info",
        "info": info
      })
      await asyncio.sleep(0.01)

def main(argv=None):
  if argv is None:
    argv = sys.argv[1:]

  parser = argparse.ArgumentParser(description="AiderDesk Connector")
  parser.add_argument("--watch-files", action="store_true", help="Watch files for changes")
  parser.add_argument("--reasoning-effort", type=str, default=None, help="Set the reasoning effort for the model")
  parser.add_argument("--thinking-tokens", type=str, default=None, help="Set the thinking tokens for the model")
  args, _ = parser.parse_known_args(argv) # Use parse_known_args to ignore unknown args

  server_url = os.getenv("CONNECTOR_SERVER_URL", "http://localhost:24337")
  base_dir = os.getenv("BASE_DIR", os.getcwd())
  connector = Connector(
    base_dir,
    watch_files=args.watch_files,
    server_url=server_url,
    reasoning_effort=args.reasoning_effort,
    thinking_tokens=args.thinking_tokens
  )
  asyncio.run(connector.start())


if __name__ == "__main__":
  main()
