#!/bin/bash

export HOME=/home/okabe
export DEBUG=on

. ${HOME}/.bash_profile
nvm use v0.12.14
node --expose_gc SRV.js -l 0
