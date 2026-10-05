const d = new Date();
const offset = d.getTimezoneOffset();
d.setMinutes(d.getMinutes() - offset);
console.log(d.toISOString().split('T')[0]);
