import sys

def check_balance(filename):
    with open(filename, 'r') as f:
        content = f.read()

    stack = []
    in_string = None
    in_comment = None

    i = 0
    while i < len(content):
        char = content[i]
        next_char = content[i+1] if i + 1 < len(content) else ""

        if in_comment == "//":
            if char == '\n':
                in_comment = None
        elif in_comment == "/*":
            if char == '*' and next_char == "/":
                in_comment = None
                i += 1
        elif in_string:
            if char == in_string:
                # Basic escape handling
                if content[i-1] != '\\' or (i>1 and content[i-2] == '\\'):
                    in_string = None
        else:
            if char == '/' and next_char == "/":
                in_comment = "//"
                i += 1
            elif char == '/' and next_char == "*":
                in_comment = "/*"
                i += 1
            elif char in ("'", '"', "`"):
                in_string = char
            elif char in ("{", "(", "["):
                stack.append((char, i))
            elif char in ("}", ")", "]"):
                if not stack:
                    print(f"Extra closing {char} at index {i}")
                else:
                    opening, pos = stack.pop()
                    if (opening == "{" and char != "}") or \
                       (opening == "(" and char != ")") or \
                       (opening == "[" and char != "]"):
                        line = content.count('\n', 0, i) + 1
                        print(f"Mismatch: {opening} at index {pos} closed by {char} at line {line}")
        i += 1

    if stack:
        for opening, pos in stack:
            line = content.count('\n', 0, pos) + 1
            print(f"Unclosed {opening} at line {line}")
    else:
        print("All balanced!")

check_balance('client/src/pages/NuovaVisita.tsx')
