// Campo de teléfono: solo números, espacios y guiones, con un máximo de 8 números.
export const MAX_DIGITOS_TELEFONO = 8;

export function limitarTelefono(input) {
  input.setAttribute('inputmode', 'numeric');
  input.addEventListener('input', () => {
    let digitos = 0;
    input.value = [...input.value]
      .filter(c => /[\d\- ]/.test(c) && (!/\d/.test(c) || ++digitos <= MAX_DIGITOS_TELEFONO))
      .join('');
  });
}
