/** S11 Trash, opened from Settings: the same Keep-style screen, fixed on the trash. */
import { Browse } from '@/features/Browse';

export default function TrashScreen() {
  return <Browse fixed={{ kind: 'trash' }} />;
}
