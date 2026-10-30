[ -f ~/.bashrc ] && . ~/.bashrc
case "$(cat /proc/cmdline)" in
# SNAPSHOT_FLAG in tools/build-state.mjs: the build is about to take the snapshot.
# This shell is in the snapshot, so its $RANDOM would start out the same for
# every visitor; reseed it from the kernel once the page has seeded that.
*resume.snapshot*) /usr/local/libexec/await-resume; RANDOM=$SRANDOM; clear ;;
esac
welcome
