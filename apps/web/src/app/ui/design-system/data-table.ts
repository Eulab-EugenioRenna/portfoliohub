import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface DataTableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'ph-data-table',
  templateUrl: './data-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhDataTable {
  readonly columns = input.required<DataTableColumn[]>();
  readonly rows = input.required<Array<Record<string, string>>>();
  readonly filterPlaceholder = input('Filtra la tabella…');
  readonly query = signal('');
  readonly filteredRows = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('it');
    if (!query) return this.rows();
    return this.rows().filter((row) =>
      Object.values(row).some((value) => value.toLocaleLowerCase('it').includes(query)),
    );
  });
}
