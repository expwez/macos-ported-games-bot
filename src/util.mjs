
export function escapeCharacters(input) {
  const charactersToEscape = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];

  let escapedInput = '';
  for (let i = 0; i < input.length; i++) {
    if (charactersToEscape.includes(input[i])) {
      escapedInput += '\\' + input[i];
    } else {
      escapedInput += input[i];
    }
  }

  return escapedInput;
}