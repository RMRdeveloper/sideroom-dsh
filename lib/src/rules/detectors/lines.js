export function isBlank(line) {
    return line.trim() === '';
}
export function isLineComment(line) {
    return line.startsWith('//') || line.startsWith('#');
}
export function closingParen(text, open) {
    let depth = 0;
    for (let index = open; index < text.length; index += 1) {
        const character = text[index];
        if (character === '(') {
            depth += 1;
        }
        else if (character === ')') {
            depth -= 1;
            if (depth === 0) {
                return index;
            }
        }
    }
    return -1;
}
export function nextMeaningful(lines, from) {
    for (let index = from; index < lines.length; index += 1) {
        const text = lines[index].trim();
        if (text !== '') {
            return text;
        }
    }
    return null;
}
export function blockBody(lines, from) {
    const body = [];
    for (let index = from; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (trimmed.startsWith('}')) {
            break;
        }
        if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('*')) {
            continue;
        }
        body.push(trimmed);
    }
    return body;
}
