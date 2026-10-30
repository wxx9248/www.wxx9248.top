# Sourced by the scripts that talk to the web page; see /usr/local/sbin/hostagent.
# Must match web/src/machine/vm/vm.ts: the page's HOST_CHANNEL is serial port 1, ttyS1.
HOST_PORT=/dev/ttyS1
# The login shell waits here while the snapshot is taken; hostagent writes to it on resume.
RESUME_FIFO=/run/resume.fifo
# Exists once the page has restored the snapshot, so later logins (after
# `exit`) don't wait for a resume that already happened.
RESUMED_MARK=/run/resumed
