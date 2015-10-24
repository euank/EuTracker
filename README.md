# EuTracker

A small bittorrent tracker I wrote way back when.

This sucker hasn't been battle-tested at all, but it should be fairly scalable. Hopefully. :grin:

Future plans include adding a distributed store for peers so you can run
multiple copies to scale horizontally-ish, though you already could to some
extent since the Bittorrent protocol doesn't require any real consistency, not
even "eventual".

# License

AGPLv3
