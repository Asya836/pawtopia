export function getYearsSince(dateValue, now = new Date()) {
    if (!dateValue) return 0

    const startDate = new Date(dateValue)
    if (Number.isNaN(startDate.getTime())) return 0

    let years = now.getFullYear() - startDate.getFullYear()
    const anniversary = new Date(now.getFullYear(), startDate.getMonth(), startDate.getDate())

    if (now < anniversary) {
        years -= 1
    }

    return Math.max(0, years)
}

export function getEstimatedPetAge(pet, now = new Date()) {
    const baseAge = Number(pet?.age)
    if (!Number.isFinite(baseAge)) return null

    return Math.max(0, baseAge + getYearsSince(pet?.createdAt, now))
}

export function formatEstimatedPetAge(pet, fallback = '—') {
    const age = getEstimatedPetAge(pet)
    return age === null ? fallback : String(age)
}
