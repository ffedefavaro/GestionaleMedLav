with open('client/src/pages/NuovaVisita.tsx', 'r') as f:
    content = f.read()
    s_curly = 0
    s_round = 0
    s_square = 0
    for line_no, line in enumerate(content.splitlines(), 1):
        for char in line:
            if char == '{': s_curly += 1
            if char == '}': s_curly -= 1
            if char == '(': s_round += 1
            if char == ')': s_round -= 1
            if char == '[': s_square += 1
            if char == ']': s_square -= 1
        if s_curly < 0 or s_round < 0 or s_square < 0:
            print(f"Negative balance at line {line_no}: curly={s_curly}, round={s_round}, square={s_square}")
    print(f"Final balance: curly={s_curly}, round={s_round}, square={s_square}")
