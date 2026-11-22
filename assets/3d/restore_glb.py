#!/usr/bin/env python3
"""Restore a lossless GLB archived as .glb.gz.b64. Python standard library only."""
import argparse
import base64
import gzip
import hashlib
from pathlib import Path

EXPECTED = {
    "chaton_voxel_v2.glb.gz.b64": ("9f0e1479b45d9bef789fce1e183bf21f0251102eb7f859ee887388a339ab8df8", 42248),
    "chaton_voxel_v1.glb.gz.b64": ("1633b8bb9913e6eddaf0669e6dab320e410a7eac95e208acd615b7af1330942f", 28604),
}

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="GitHub file ending .glb.gz.b64")
    parser.add_argument("destination", type=Path, help="Output .glb file")
    args = parser.parse_args()
    if args.destination.suffix.lower() != ".glb":
        parser.error("Destination must end in .glb")
    encoded = args.source.read_text(encoding="ascii")
    binary = gzip.decompress(base64.b64decode("".join(encoded.split()), validate=True))
    if len(binary) < 12 or binary[:4] != b"glTF" or int.from_bytes(binary[4:8], "little") != 2:
        raise ValueError("Invalid GLB header/version")
    if int.from_bytes(binary[8:12], "little") != len(binary):
        raise ValueError("Invalid declared GLB length")
    digest = hashlib.sha256(binary).hexdigest()
    if args.source.name in EXPECTED and (digest, len(binary)) != EXPECTED[args.source.name]:
        raise ValueError(f"SHA256 or size mismatch: {digest}, {len(binary)} bytes")
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.write_bytes(binary)
    print(f"Restored {args.destination} ({len(binary)} bytes, sha256={digest})")

if __name__ == "__main__":
    main()
