#!/bin/bash

export HOME=/home/ec2-user
export DEBUG=on

. ${HOME}/.bash_profile
nvm use v0.12.14
node --expose_gc SRV.js -l 0
