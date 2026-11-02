.DEFAULT_GOAL := help
.PHONY: help setup build install uninstall clean

help:
	@printf '%s\n' 'make install    Build, install, and open the Safari extension app' 'make build      Build the app without installing it' 'make setup      Create your private config (preserves existing settings)' 'make uninstall  Remove the installed app' 'make clean      Remove build output (keeps your private config)'

setup:
	@./scripts/setup-local.sh

build:
	@./scripts/build-local.sh

install:
	@./scripts/install-local.sh

uninstall:
	@./scripts/uninstall-local.sh

clean:
	rm -rf build
