"""Inicialización idempotente de la base independiente de demostración."""

from .demo_fixture import load_demo_fixture
from .storage import Repository


def main():
    if Repository().initialize(load_demo_fixture()):
        print("Demo de Don Tino cargada en PostgreSQL con la ficha v11 y el plan v5.")
    else:
        print("PostgreSQL de LuumIA listo.")


if __name__ == "__main__":
    main()
