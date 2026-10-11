import argparse
import asyncio

from eriknar.catalog.demo_seed import seed_demo_catalog
from eriknar.db.session import session_factory


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m eriknar.catalog.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("seed-demo")
    args = parser.parse_args()

    if args.command == "seed-demo":
        result = asyncio.run(seed_demo_catalog(session_factory))
        print(f"Demo catalog ready: {result.total_created} records created")


if __name__ == "__main__":
    main()
