import { useState } from 'react'
import { ReceiptScanner } from '../components/FeatureComponents'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X, Receipt, Camera, Edit2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import { formatCurrency, formatDate, CURRENCIES } from '../lib/utils'
import toast from 'react-hot-toast'

const CATS = ['Software','Hardware','Travel','Meals','Office','Marketing','Contractor','Utilities','Rent','Insurance','Legal','Other']

export default function ExpensesPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [filterCat, setFilterCat] = useState('')
  const today = new Date().toISOString().split('T')[0]

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', filterCat],
    queryFn: () => api.get<any[]>(`/expenses${filterCat ? `?category=${filterCat}` : ''}`)
  })
  const { data: summary } = useQuery({ queryKey: ['expense-summary'], queryFn: () => api.get<any>('/expenses/summary') })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => api.get<any[]>('/clients') })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get<any>('/auth/profile') })

  const defaultCurrency = profile?.default_currency || 'GBP'

  const saveMutation = useMutation({
    mutationFn: (data: any) => editingExpense
      ? api.put(`/expenses/${editingExpense.id}`, data)
      : api.post('/expenses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
      toast.success(editingExpense ? 'Expense updated!' : 'Expense added!')
      setShowModal(false)
      setEditingExpense(null)
    },
    onError: (e: any) => toast.error(e.message)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
      toast.success('Deleted')
    }
  })

  const { register, handleSubmit, reset } = useForm()

  const openNew = () => {
    setEditingExpense(null)
    reset({ date: today, currency: defaultCurrency, is_billable: false, category: 'Software' })
    setShowModal(true)
  }

  const openEdit = (expense: any) => {
    setEditingExpense(expense)
    reset({ ...expense, client_id: expense.client_id || '' })
    setShowModal(true)
  }

  const list = Array.isArray(expenses) ? expenses : []
  const totalExpenses = summary?.total || 0

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Expenses</h1><p className="page-subtitle">Track business costs & receipts</p></div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={() => setShowScanner(true)}><Camera size={15}/> Scan receipt</button>
          <button className="btn btn-primary" onClick={openNew}><Plus size={15}/> Add expense</button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          <div className="metric-card">
            <div className="metric-label">Total expenses</div>
            <div className="metric-value" style={{ color:'var(--red)' }}>{formatCurrency(totalExpenses, defaultCurrency)}</div>
            <div className="metric-sub">{list.length} records</div>
          </div>
          {Object.entries(summary?.by_category || {}).slice(0,3).map(([cat, amt]: any) => (
            <div key={cat} className="metric-card">
              <div className="metric-label">{cat}</div>
              <div className="metric-value" style={{ fontSize:18 }}>{formatCurrency(amt, defaultCurrency)}</div>
              <div className="metric-sub">{((amt/totalExpenses)*100).toFixed(0)}% of total</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ marginBottom:14 }}>
          <select className="form-select" style={{ width:200 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {isLoading ? (
            <div className="empty-state">Loading...</div>
          ) : list.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Receipt size={20}/></div>
              <div style={{ fontWeight:500 }}>No expenses yet</div>
              <div style={{ fontSize:13, color:'var(--text-subtle)', margin:'4px 0 16px' }}>Track your business costs to calculate net profit</div>
              <button className="btn btn-primary" onClick={openNew}><Plus size={15}/> Add expense</button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Category</th><th>Description</th><th>Client</th><th>Amount</th><th>Billable</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((e: any) => (
                  <tr key={e.id}>
                    <td style={{ color:'var(--text-subtle)', fontSize:12 }}>{formatDate(e.date)}</td>
                    <td><span className="badge badge-draft">{e.category}</span></td>
                    <td>{e.description}{e.ai_scanned && <span style={{ fontSize:10, color:'var(--text-subtle)', marginLeft:6 }}>AI</span>}</td>
                    <td style={{ color:'var(--text-subtle)' }}>{e.clients?.name || '—'}</td>
                    <td className="currency-amount" style={{ fontWeight:500 }}>{formatCurrency(e.amount, e.currency)}</td>
                    <td>{e.is_billable ? <span className="badge badge-sent">{e.is_billed ? 'Billed' : 'Billable'}</span> : <span style={{ color:'var(--text-subtle)', fontSize:12 }}>—</span>}</td>
                    <td style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(e)}><Edit2 size={12}/></button>
                      <button className="btn btn-sm btn-danger" onClick={() => { if(confirm('Delete expense?')) deleteMutation.mutate(e.id) }}><Trash2 size={12}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth:520 }}>
            <div className="modal-header">
              <h2 style={{ fontSize:17, fontWeight:700 }}>{editingExpense ? 'Edit expense' : 'Add expense'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowModal(false); setEditingExpense(null) }}><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))}>
              <div className="modal-body">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select {...register('category')} className="form-select">
                      {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input {...register('date')} className="form-input" type="date"/>
                  </div>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}>
                    <label className="form-label">Description *</label>
                    <input {...register('description', { required: true })} className="form-input" placeholder="e.g. Adobe Creative Cloud monthly subscription"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount *</label>
                    <input {...register('amount', { required:true, valueAsNumber:true })} className="form-input" type="number" min="0" step="0.01"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Currency</label>
                    <select {...register('currency')} className="form-select">
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tax / VAT amount</label>
                    <input {...register('tax_amount', { valueAsNumber:true })} className="form-input" type="number" min="0" step="0.01" placeholder="0.00"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Receipt / reference</label>
                    <input {...register('reference')} className="form-input" placeholder="Invoice # or receipt ref"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Client (if billable)</label>
                    <select {...register('client_id')} className="form-select">
                      <option value="">No client</option>
                      {(Array.isArray(clients) ? clients : []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', gap:8 }}>
                    <input {...register('is_billable')} type="checkbox" id="billable" style={{ width:'auto' }}/>
                    <label htmlFor="billable" className="form-label" style={{ margin:0, cursor:'pointer' }}>Mark as billable to client</label>
                  </div>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}>
                    <label className="form-label">Notes (optional)</label>
                    <textarea {...register('notes')} className="form-input" rows={2} style={{ resize:'vertical' }}/>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingExpense(null) }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : editingExpense ? 'Update expense' : 'Add expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScanner && (
        <ReceiptScanner
          onSave={() => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-summary'] }); setShowScanner(false) }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  )
}
