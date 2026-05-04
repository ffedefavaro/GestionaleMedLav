with open('client/src/pages/NuovaVisita.tsx', 'r') as f:
    content = f.read()
    stack = []
    for i, char in enumerate(content):
        if char == '{':
            stack.append(i)
        elif char == '}':
            if not stack:
                print(f"Extra closing brace at index {i}")
            else:
                stack.pop()
    if stack:
        for pos in stack:
            line = content.count('\n', 0, pos) + 1
            print(f"Unclosed opening brace at line {line}")
