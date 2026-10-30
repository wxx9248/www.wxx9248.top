HISTCONTROL=ignoreboth
# The \e]0;…\a part sets the terminal title, which the page shows in its tab.
PS1='\[\e]0;\u@\h: \w\a\]\[\e[1;32m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ '
alias ls='ls --color=auto' ll='ls -l' la='ls -la'
export EDITOR=vim BROWSER=open LESS=-R
[ -r /usr/share/bash-completion/bash_completion ] && . /usr/share/bash-completion/bash_completion
