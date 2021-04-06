import { aFunction, myConst } from "./subfile";
const newConst = {
    someKey: myConst,
};
export const getStuff = () => {
    return Object.assign(Object.assign({}, newConst), { someFunc: () => aFunction() });
};
//# sourceMappingURL=index.js.map