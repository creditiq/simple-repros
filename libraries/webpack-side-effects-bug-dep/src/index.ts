import { importantFnThatNeedsToBeIncluded } from './subproj';

export const getSomeStuff = () => {
  return {
    someFunc: () => importantFnThatNeedsToBeIncluded(),
  };
};
