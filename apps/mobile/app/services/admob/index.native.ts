// AdMob removed — export no-op stubs to keep any conditional imports safe
export const RewardedAd = {
  createForAdRequest: (_adUnitId: string, _options?: any) => ({
    addAdEventListener: (_eventType: string, _listener: () => void) => () => {},
    load: () => {},
    show: () => {},
  }),
};

export const RewardedAdEventType = {
  LOADED: 'loaded' as const,
  EARNED_REWARD: 'earned_reward' as const,
};

export const AdEventType = {
  CLOSED: 'closed' as const,
};

export const TestIds = {
  REWARDED: 'test-rewarded-id' as const,
};
