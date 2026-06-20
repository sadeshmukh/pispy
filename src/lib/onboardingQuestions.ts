export type OnboardingQuestion = {
  key: string;
  label: string;
  placeholder?: string;
  required: boolean;
  multiline?: boolean;
};

export const requiredOnboardingQuestions: OnboardingQuestion[] = [
  {
    key: 'hat',
    label: 'Are you wearing a hat? If yes, what color or style?',
    placeholder: 'No hat, or black baseball cap',
    required: true,
  },
  {
    key: 'shirt',
    label: 'What shirt, hoodie, jacket, or top are you wearing?',
    placeholder: 'Blue hoodie with white logo',
    required: true,
  },
  {
    key: 'pants',
    label: 'What pants, skirt, shorts, or bottoms are you wearing?',
    placeholder: 'Black jeans',
    required: true,
  },
  {
    key: 'shoes',
    label: 'What shoes are you wearing?',
    placeholder: 'White sneakers',
    required: true,
  },
  {
    key: 'glasses',
    label: 'Are you wearing glasses, sunglasses, or anything on your face?',
    placeholder: 'No glasses, or round black glasses',
    required: true,
  },
  {
    key: 'hair',
    label: 'What does your hair look like today?',
    placeholder: 'Short brown hair, ponytail, dyed blue tips',
    required: true,
  },
  {
    key: 'bag',
    label: 'Do you have a backpack, tote, lanyard, or other bag?',
    placeholder: 'Red backpack, no bag, black tote',
    required: true,
  },
  {
    key: 'badge_position',
    label: 'Where is your badge visible in the photo?',
    placeholder: 'On my lanyard, clipped to my shirt, held in my hand',
    required: true,
  },
  {
    key: 'distinctive_item',
    label: 'What is one other visible thing that could help identify you?',
    placeholder: 'Sticker-covered laptop, green water bottle, striped scarf',
    required: true,
  },
];

export const optionalOnboardingQuestions: OnboardingQuestion[] = [
  {
    key: 'extra_clues',
    label: 'Optional extra clues',
    placeholder: 'Anything else that would help an admin or player identify you.',
    required: false,
    multiline: true,
  },
];

export const onboardingQuestions = [
  ...requiredOnboardingQuestions,
  ...optionalOnboardingQuestions,
];

export const onboardingQuestionByKey = new Map(
  onboardingQuestions.map(question => [question.key, question])
);
