.PHONY: install uninstall clean

install:
	./scripts/install-local.sh

uninstall:
	./scripts/uninstall-local.sh

clean:
	rm -rf build
