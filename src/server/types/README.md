# Types Files

Generally, types are defined where they are used. However, type definitions intended to be
shared with the fronted are placed in the files in this directory. This ensures only types
and associated variables are loaded when imported, avoiding issues of a frontend file
erroneously importing a backend library (for example, something from node).
