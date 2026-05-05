import os
import re

f = 'client/src/pages/Aziende.tsx'
content = open(f).read()

# 1. Resolve imports and interfaces
pattern1 = r'<<<<<<< HEAD\nimport { executeQuery, runCommand, runCommands } from \'\.\./lib/db\';\nimport {\n  Plus, Search, Edit2, Trash2, Building2, MapPin,\n  ClipboardList, Copy, Shield, AlertCircle, Download,\n  ListChecks, X, ChevronDown, ChevronUp, Users, Briefcase,\n  ChevronRight\n} from \'lucide-react\';\nimport { jsPDF } from \'jspdf\';\n\ninterface Exam \{\n  nome: string;\n  periodicita: number;\n  obbligatorio: boolean;\n\}\n=======\nimport { executeQuery, runCommand } from \'\.\./lib/db\';\nimport { Plus, Search, Edit2, Trash2, Building2, MapPin, ClipboardList, X } from \'lucide-react\';\n>>>>>>> 464d2b7 \(WIP changes before rebase\)'
replacement1 = """import { executeQuery, runCommand, runCommands } from '../lib/db';
import {
  Plus, Search, Edit2, Trash2, Building2, MapPin,
  ClipboardList, Copy, Shield, AlertCircle, Download,
  ListChecks, X, ChevronDown, ChevronUp, Users, Briefcase,
  ChevronRight
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Exam {
  nome: string;
  periodicita: number;
  obbligatorio: boolean;
}"""

content = re.sub(pattern1, replacement1, content, flags=re.DOTALL)

# 2. Resolve state
pattern2 = r'<<<<<<< HEAD\n  const \[showProtocolForm, setShowProtocolForm\] = useState\(false\);\n  const \[showCloneModal, setShowCloneModal\] = useState\(false\);\n  const \[protocolToClone, setProtocolToClone\] = useState<any>\(null\);\n  const \[targetCompanyId, setTargetCompanyId\] = useState\(\'\'\);\n  const \[editingProtocolId, setEditingProtocolId\] = useState<number \| null>\(null\);\n\n=======\n  const \[showExamsModal, setShowExamsModal\] = useState\(false\);\n  const \[exams, setExams\] = useState<any\[\]>\(\[\]\);\n>>>>>>> 464d2b7 \(WIP changes before rebase\)'
replacement2 = """  const [showProtocolForm, setShowProtocolForm] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [protocolToClone, setProtocolToClone] = useState<any>(null);
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [editingProtocolId, setEditingProtocolId] = useState<number | null>(null);
  const [showExamsModal, setShowExamsModal] = useState(false);
  const [exams, setExams] = useState<any[]>([]);"""

content = re.sub(pattern2, replacement2, content, flags=re.DOTALL)

# 3. Resolve useEffect
pattern3 = r'<<<<<<< HEAD\n    fetchData\(\);\n=======\n    fetchAziende\(\);\n    fetchExams\(\);\n>>>>>>> 464d2b7 \(WIP changes before rebase\)'
replacement3 = """    fetchData();
    fetchExams();"""

content = re.sub(pattern3, replacement3, content, flags=re.DOTALL)

open(f, 'w').write(content)
