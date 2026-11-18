import assert from 'node:assert/strict'
import test from 'node:test'
import { responseFieldErrors } from '../src/lib/errors.ts'
test('nested medication errors retain item index and field path', () => {
 const error={isAxiosError:true,response:{data:{fields:{items:[{}, {end_date:['Kurs 1–90 kun bo‘lishi kerak.'],local_times:{0:['Vaqt noto‘g‘ri.']}}],version:['Eskirgan.']}}}}
 assert.deepEqual(responseFieldErrors(error),{'items.1.end_date':'Kurs 1–90 kun bo‘lishi kerak.','items.1.local_times.0':'Vaqt noto‘g‘ri.',version:'Eskirgan.'})
})
