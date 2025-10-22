#!/usr/bin/env python

import sys

def log_info(message):
    """Log informational messages to stderr."""
    sys.stderr.write(f"CONNECTOR INFO: {message}\n")
    sys.stderr.flush()

def log_warning(message):
    """Log warning messages to stderr."""
    sys.stderr.write(f"CONNECTOR WARNING: {message}\n")
    sys.stderr.flush()

def log_error(message):
    """Log error messages to stderr."""
    sys.stderr.write(f"CONNECTOR ERROR: {message}\n")
    sys.stderr.flush()

def log_debug(message):
    """Log debug messages to stderr."""
    sys.stderr.write(f"CONNECTOR DEBUG: {message}\n")
    sys.stderr.flush()
