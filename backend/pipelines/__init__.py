import importlib

p1 = importlib.import_module("backend.pipelines.01_basic")
run_basic_rag = p1.run_basic_rag

__all__ = ["run_basic_rag"]
