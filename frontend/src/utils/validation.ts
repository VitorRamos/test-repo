const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DETRAN_LICENSE_REGEX = /^[A-Z0-9]{6,20}$/

export const normalizeEmail = (value: string) => value.trim().toLowerCase()

export const isValidEmail = (value: string) => EMAIL_REGEX.test(normalizeEmail(value))

export const normalizeCpf = (value: string) => value.replace(/\D/g, "")

export const formatCpf = (value: string) => {
  const digits = normalizeCpf(value).slice(0, 11)

  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

export const isValidCpf = (value: string) => {
  const cpf = normalizeCpf(value)

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }

  let sum = 0
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf[index]) * (10 - index)
  }

  let remainder = (sum * 10) % 11
  if (remainder === 10) {
    remainder = 0
  }
  if (remainder !== Number(cpf[9])) {
    return false
  }

  sum = 0
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf[index]) * (11 - index)
  }

  remainder = (sum * 10) % 11
  if (remainder === 10) {
    remainder = 0
  }

  return remainder === Number(cpf[10])
}

export const normalizeDetranLicense = (value: string) =>
  value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()

export const isValidDetranLicense = (value: string) =>
  DETRAN_LICENSE_REGEX.test(normalizeDetranLicense(value))
