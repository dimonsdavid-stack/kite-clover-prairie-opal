import { createFileRoute } from '@tanstack/react-router';
import { schedulerTick } from '@/lib/arclenos/operations/scheduler.server';
export const Route = createFileRoute('/api/ops/tick')({server:{handlers:{GET:({request})=>schedulerTick(request),POST:({request})=>schedulerTick(request)}}});
