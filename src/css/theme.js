export const cssVariables = {
    '--light-one': '#f8edeb',
    '--light-two': '#f9dcc4',
    '--light-three': '#fcd5ce',
    '--light-four': '#fec89a',
    '--light-five': '#ffb5a7',
    '--light-six': '#b2b2b2',
    '--light-six-dark': '#8a8a8a',
};

export const getColor = (variableName) => cssVariables[variableName];
