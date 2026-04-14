import { PremiumAuthLoader } from '@/components/auth/PremiumAuthLoader';
import { publicRolloutFlags } from '@/lib/public-rollout-flags';

export default function AuthLoading() {
  return (
    <PremiumAuthLoader
      premium={publicRolloutFlags.premiumAuthLoader}
      statusText="Composing your style atmosphere"
    />
  );
}
