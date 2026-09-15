import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as common from "@zxcvbn-ts/language-common";
import * as english from "@zxcvbn-ts/language-en";
import * as french from "@zxcvbn-ts/language-fr";

const passwordChecker = new ZxcvbnFactory({
  dictionary: {
    ...common.dictionary,
    ...english.dictionary,
    ...french.dictionary,
  },
  graphs: common.adjacencyGraphs,
  translations: english.translations,
  useLevenshteinDistance: true,
});

export const validatePasswordStrength = (
  password: string,
  personalInformation: string[],
): string | null => {
  const result = passwordChecker.check(
    password,
    personalInformation,
  );

  if (result.score < 3) {
    return (
      result.feedback.warning ||
      result.feedback.suggestions[0] ||
      "Password is too weak or too common"
    );
  }

  return null;
};