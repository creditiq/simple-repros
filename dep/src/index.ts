import { aFunction, myConst } from "./subfile";

const newConst = {
  someKey: myConst,
};

export const getStuff = () => {
  return {
    ...newConst,
    someFunc: () => aFunction(),
  };
};
