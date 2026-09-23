import { INGREDIENTS } from "./src/lib/racik/data";
console.log(INGREDIENTS.length);
console.log(INGREDIENTS.filter(i=>/bebek|ayam|sambal|tapioka/i.test(i.name+i.id)).map(i=>[i.id,i.name,i.aliases]));
