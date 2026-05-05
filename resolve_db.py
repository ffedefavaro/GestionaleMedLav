import sys

content = open('client/src/lib/db.ts').read()
resolved = content.replace("<<<<<<< HEAD\n    \"ALTER TABLE workers ADD COLUMN sesso TEXT;\"\n    \"ALTER TABLE workers ADD COLUMN data_nascita DATE;\"\n=======\n    \"ALTER TABLE exams_master ADD COLUMN costo_base REAL;\"\n>>>>>>> 464d2b7 (WIP changes before rebase)",
                    "\"ALTER TABLE workers ADD COLUMN sesso TEXT;\",\n    \"ALTER TABLE workers ADD COLUMN data_nascita DATE;\",\n    \"ALTER TABLE exams_master ADD COLUMN costo_base REAL;\"")
# Wait, I missed some commas or formatting. Let's be careful.
# Original HEAD part likely had commas if it was a list.
