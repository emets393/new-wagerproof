import * as React from 'react';
import { HoneydewOptionCard } from './HoneydewOptionCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentParlays, useAgentPicks } from '@/hooks/useAgents';
import { submitAgentPickFeedback } from '@/services/agentPickFeedbackService';
import type { AgentProfile } from '@/types/agent';

interface AgentPickFeedbackCardProps {
  agent: AgentProfile;
}

/**
 * Web port of Honeydew's recipe-detail "How did we do?" card. Same coral
 * option-card chrome and Report → Submit → Thanks flow; writes to
 * `agent_pick_feedback` for periodic review.
 */
export function AgentPickFeedbackCard({ agent }: AgentPickFeedbackCardProps) {
  const { user } = useAuth();
  const { data: picks = [] } = useAgentPicks(agent.id);
  const { data: parlays = [] } = useAgentParlays(agent.id);

  const [reportOpen, setReportOpen] = React.useState(false);
  const [thanksOpen, setThanksOpen] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const submitReport = async () => {
    if (isSubmitting || !user?.id) return;
    setIsSubmitting(true);
    try {
      await submitAgentPickFeedback({
        userId: user.id,
        agent,
        picks,
        parlays,
        userDescription: description.trim(),
      });
      setDescription('');
      setThanksOpen(true);
    } catch {
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <HoneydewOptionCard
        title="How did we do?"
        subtitle="Tap to report a mistake"
        actionWord="Report"
        primaryColor="rgb(255, 64, 77)"
        secondaryColor="rgb(255, 158, 128)"
        onClick={() => setReportOpen(true)}
      />

      <AlertDialog open={reportOpen} onOpenChange={setReportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report an Issue</AlertDialogTitle>
            <AlertDialogDescription>
              What went wrong with this agent's picks?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the issue (optional)..."
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDescription('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                setReportOpen(false);
                void submitReport();
              }}
            >
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={thanksOpen} onOpenChange={setThanksOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thanks for the feedback.</AlertDialogTitle>
            <AlertDialogDescription>
              We will review this agent's picks ASAP and implement fixes for next time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Ok</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
