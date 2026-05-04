with open('client/src/pages/NuovaVisita.tsx', 'r') as f:
    content = f.read()
    in_backtick = False
    for i, char in enumerate(content):
        if char == '`':
            if i > 0 and content[i-1] == '\\':
                continue
            in_backtick = not in_backtick
    if in_backtick:
        print("Unclosed backtick!")
    else:
        print("Backticks are balanced!")
