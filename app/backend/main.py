import logging
import sys

from handlers.server.server import Server

# Enable application-level logging (root logger defaults to WARNING,
# which silently drops all logger.info() calls in audio code)
# Add a StreamHandler so our custom loggers actually output to stdout
_handler = logging.StreamHandler(sys.stdout)
_handler.setLevel(logging.DEBUG)
_handler.setFormatter(
    logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
)
for _name in ("webrtc-audio", "webrtc-audio-routes"):
    _logger = logging.getLogger(_name)
    _logger.setLevel(logging.DEBUG)
    _logger.addHandler(_handler)
# aioice is very verbose at INFO — keep at WARNING for normal operation;
# set AIOICE_LOG_LEVEL=INFO in .env for detailed ICE debugging
_aioice_level = logging.getLogger("aioice").level or logging.WARNING
logging.getLogger("aioice").setLevel(_aioice_level)

server = Server()
app = server.app
