import { matchIngredient } from "./src/lib/racik/import-normalise";
import { INGREDIENTS } from "./src/lib/racik/data";
for (const n of ["Bebek peking","Bebek packing","Garam","Gula","Daun salam","Daun jeruk","Serai","Minyak","Minyak goreng","Sambel ijo","Kecap manis","Bumbu ungkep"]) console.log(n, "=>", matchIngredient(n));
console.log(INGREDIENTS.filter(i=>/gula|garam|serai|minyak|bebek|salam|jeruk/i.test(i.name)).map(i=>[i.id,i.name,i.aliases]));
