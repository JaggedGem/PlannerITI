import { StyleSheet } from 'react-native';

import { CONTENT_MAX_WIDTH, FORM_MAX_WIDTH } from '@/utils/responsiveLayout';

export const contentLayout = StyleSheet.create({
  page: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  form: { width: '100%', maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' },
  auth: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    columnGap: '4%',
    rowGap: 16,
  },
  column: { width: '48%' },
});
