import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomSelect, type SelectOption } from '../ui/custom-select';
import {
  type DataTableColumn,
  PhBadge,
  PhButton,
  PhCard,
  PhDataTable,
  PhDateInput,
  PhField,
  PhNoticeBanner,
  PhPasswordInput,
  PhSectionHeading,
  PhSkeleton,
} from '../ui/design-system';

@Component({
  selector: 'ph-design-system-page',
  imports: [
    FormsModule,
    CustomSelect,
    PhBadge,
    PhButton,
    PhCard,
    PhDataTable,
    PhDateInput,
    PhField,
    PhNoticeBanner,
    PhPasswordInput,
    PhSectionHeading,
    PhSkeleton,
  ],
  templateUrl: './design-system.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystemPage {
  protected readonly email = signal('cliente@');
  protected readonly emailTouched = signal(false);
  protected readonly emailError = computed(() => {
    if (!this.emailTouched()) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email())
      ? ''
      : 'Inserisci un indirizzo email valido.';
  });
  protected readonly password = signal('PasswordDemo!23');
  protected readonly selectedDate = signal('2026-08-15');
  protected readonly selectedRole = signal('editor');
  protected readonly bannerVisible = signal(true);
  protected readonly roleOptions: SelectOption[] = [
    { value: 'owner', label: 'Owner', description: 'Controllo completo del workspace' },
    { value: 'admin', label: 'Admin', description: 'Gestione operativa e membri' },
    { value: 'editor', label: 'Editor', description: 'File, progetti e consegne' },
    { value: 'viewer', label: 'Viewer', description: 'Consultazione senza modifiche' },
  ];
  protected readonly tableColumns: DataTableColumn[] = [
    { key: 'name', label: 'Componente' },
    { key: 'category', label: 'Categoria' },
    { key: 'state', label: 'Stato' },
    { key: 'usage', label: 'Utilizzo' },
  ];
  protected readonly tableRows = [
    { name: 'Button', category: 'Azioni', state: 'Stabile', usage: '42 schermate' },
    { name: 'Field', category: 'Form', state: 'Stabile', usage: '18 schermate' },
    { name: 'Select filtrabile', category: 'Form', state: 'Stabile', usage: '9 schermate' },
    { name: 'Notice banner', category: 'Feedback', state: 'Nuovo', usage: 'Shell' },
    { name: 'Skeleton', category: 'Feedback', state: 'Nuovo', usage: 'Caricamenti' },
  ];
  protected readonly categories = [
    { id: 'principi', label: 'Principi', index: '01' },
    { id: 'tipografia', label: 'Tipografia', index: '02' },
    { id: 'colori', label: 'Colori', index: '03' },
    { id: 'azioni', label: 'Azioni', index: '04' },
    { id: 'form', label: 'Form', index: '05' },
    { id: 'superfici', label: 'Superfici', index: '06' },
    { id: 'feedback', label: 'Feedback', index: '07' },
  ];
}
