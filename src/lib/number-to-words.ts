const a = [
  '', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '
];
const b = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
];

function inWords(num: number): string {
    if (num === 0) return '';
    if (num < 20) {
        return a[num];
    }
    const digit = num % 10;
    const ten = Math.floor(num / 10);
    return b[ten] + (digit ? '-' + a[digit] : '');
}

export function numberToWords(num: number): string {
  if (num === 0) return 'zero';
  
  const handleCrore = (n: number) => {
    if (n >= 10000000) {
      return numberToWords(Math.floor(n / 10000000)) + 'crore ' + handleLakh(n % 10000000);
    }
    return handleLakh(n);
  };

  const handleLakh = (n: number) => {
    if (n >= 100000) {
      return numberToWords(Math.floor(n / 100000)) + 'lakh ' + handleThousand(n % 100000);
    }
    return handleThousand(n);
  };

  const handleThousand = (n: number) => {
    if (n >= 1000) {
      return numberToWords(Math.floor(n / 1000)) + 'thousand ' + handleHundred(n % 1000);
    }
    return handleHundred(n);
  };

  const handleHundred = (n: number) => {
    if (n >= 100) {
      return a[Math.floor(n / 100)] + 'hundred ' + inWords(n % 100);
    }
    return inWords(n);
  };

  const [integerPart, decimalPart] = num.toString().split('.');
  
  let words = handleCrore(parseInt(integerPart, 10)).trim();
  
  if (decimalPart) {
      const paisa = parseInt(decimalPart.padEnd(2, '0').substring(0,2), 10);
      if (paisa > 0) {
        words += ' and ' + handleHundred(paisa).trim() + ' paisa';
      }
  }

  return words;
}
