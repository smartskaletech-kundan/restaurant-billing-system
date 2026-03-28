import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRestaurant } from "../context/RestaurantContext";
import { getXLSX } from "../lib/xlsx-shim";

type AttendanceStatus = "P" | "A" | "H";
type PayrollStatus = "Pending" | "Paid";

interface Employee {
  id: number;
  name: string;
  role: string;
  phone: string;
  salary: number;
  advance: number;
  active: boolean;
}

interface PayrollEntry {
  id: number;
  empName: string;
  role: string;
  basic: number;
  hra: number;
  da: number;
  medical: number;
  ta: number;
  special: number;
}

const WORKING_DAYS = 26;
const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 1,
    name: "Ramesh Yadav",
    role: "Chef",
    phone: "9812345670",
    salary: 25000,
    advance: 2000,
    active: true,
  },
  {
    id: 2,
    name: "Sonu Sharma",
    role: "Waiter",
    phone: "9876543211",
    salary: 15000,
    advance: 0,
    active: true,
  },
  {
    id: 3,
    name: "Geeta Devi",
    role: "Cashier",
    phone: "9845671235",
    salary: 18000,
    advance: 1500,
    active: true,
  },
  {
    id: 4,
    name: "Manoj Tiwari",
    role: "Manager",
    phone: "9901234568",
    salary: 35000,
    advance: 5000,
    active: true,
  },
  {
    id: 5,
    name: "Ravi Kumar",
    role: "Cleaner",
    phone: "9765432100",
    salary: 10000,
    advance: 0,
    active: false,
  },
];

function generateAttendance(empId: number): Record<number, AttendanceStatus> {
  const att: Record<number, AttendanceStatus> = {};
  for (let d = 1; d <= 27; d++) {
    const r = (empId * d * 7) % 10;
    att[d] = r < 7 ? "P" : r < 9 ? "A" : "H";
  }
  return att;
}

const INITIAL_ATTENDANCE: Record<number, Record<number, AttendanceStatus>> = {};
for (const emp of INITIAL_EMPLOYEES) {
  INITIAL_ATTENDANCE[emp.id] = generateAttendance(emp.id);
}

function calcSalaryBreakdown(
  ctc: number,
  presentDays: number,
  halfDays: number,
  workingDays: number,
  advanceDeduction: number,
) {
  const ratio = (presentDays + halfDays * 0.5) / workingDays;
  const basic = ctc * 0.5;
  const hra = basic * 0.4;
  const da = basic * 0.04;
  const medical = 1250;
  const ta = 800;
  const special = Math.max(0, ctc - basic - hra - da - medical - ta);
  const grossFull = basic + hra + da + medical + ta + special;
  const grossEarnings = grossFull * ratio;
  const basicA = basic * ratio;
  const hraA = hra * ratio;
  const daA = da * ratio;
  const medicalA = medical * ratio;
  const taA = ta * ratio;
  const specialA = special * ratio;
  const epf = basicA * 0.12;
  const esic = grossEarnings <= 21000 ? grossEarnings * 0.0075 : 0;
  const totalDeductions = epf + esic + advanceDeduction;
  const netPay = grossEarnings - totalDeductions;
  return {
    basic: basicA,
    hra: hraA,
    da: daA,
    medical: medicalA,
    ta: taA,
    special: specialA,
    grossEarnings,
    epf,
    esic,
    advance: advanceDeduction,
    totalDeductions,
    netPay,
  };
}

function initPayrollEntries(): PayrollEntry[] {
  return INITIAL_EMPLOYEES.map((emp) => {
    const sb = calcSalaryBreakdown(
      emp.salary,
      WORKING_DAYS,
      0,
      WORKING_DAYS,
      0,
    );
    return {
      id: emp.id,
      empName: emp.name,
      role: emp.role,
      basic: Math.round(sb.basic),
      hra: Math.round(sb.hra),
      da: Math.round(sb.da),
      medical: Math.round(sb.medical),
      ta: Math.round(sb.ta),
      special: Math.round(sb.special),
    };
  });
}

function getRestaurantName(restaurantId?: string): string {
  if (restaurantId) {
    const name = localStorage.getItem(`${restaurantId}_settings_name`);
    if (name) return name;
  }
  try {
    const raw = localStorage.getItem("restaurantSettings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.name || "Restaurant";
    }
  } catch {
    // ignore
  }
  return "Restaurant";
}

export default function AttendancePayroll() {
  const { restaurantId } = useRestaurant();
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [attendance, setAttendance] =
    useState<Record<number, Record<number, AttendanceStatus>>>(
      INITIAL_ATTENDANCE,
    );
  const [payrollStatus, setPayrollStatus] = useState<
    Record<number, PayrollStatus>
  >(
    Object.fromEntries(
      INITIAL_EMPLOYEES.map((e) => [e.id, "Pending" as PayrollStatus]),
    ),
  );
  const [advanceDeductions, setAdvanceDeductions] = useState<
    Record<number, number>
  >(Object.fromEntries(INITIAL_EMPLOYEES.map((e) => [e.id, e.advance])));
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [newEmp, setNewEmp] = useState({
    name: "",
    role: "",
    phone: "",
    salary: "",
    advance: "",
  });

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Payslip modal
  const [payslipEmp, setPayslipEmp] = useState<Employee | null>(null);

  // Bulk Payroll state
  const [payrollEntries, setPayrollEntries] =
    useState<PayrollEntry[]>(initPayrollEntries);
  const importRef = useRef<HTMLInputElement>(null);

  // Load persisted employees on mount
  useEffect(() => {
    const saved = localStorage.getItem(`${restaurantId}_employees`);
    if (saved) {
      try {
        setEmployees(JSON.parse(saved));
      } catch {}
    }
  }, [restaurantId]);

  // Load persisted payroll entries on mount
  useEffect(() => {
    const saved = localStorage.getItem(`${restaurantId}_payroll_entries`);
    if (saved) {
      try {
        setPayrollEntries(JSON.parse(saved));
      } catch {}
    }
  }, [restaurantId]);

  // Save employees whenever they change
  useEffect(() => {
    if (restaurantId) {
      localStorage.setItem(
        `${restaurantId}_employees`,
        JSON.stringify(employees),
      );
    }
  }, [employees, restaurantId]);

  // Filtered lists
  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.role.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredPayrollEntries = payrollEntries.filter(
    (e) =>
      e.empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.role.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  function updateEntry(
    id: number,
    field: keyof PayrollEntry,
    value: string | number,
  ) {
    setPayrollEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              [field]:
                typeof value === "string" &&
                field !== "empName" &&
                field !== "role"
                  ? Number(value) || 0
                  : value,
            }
          : e,
      ),
    );
  }

  function addBulkRow() {
    const newId = Date.now();
    setPayrollEntries((prev) => [
      ...prev,
      {
        id: newId,
        empName: "",
        role: "",
        basic: 0,
        hra: 0,
        da: 0,
        medical: 0,
        ta: 0,
        special: 0,
      },
    ]);
  }

  function saveRow(entry: PayrollEntry) {
    localStorage.setItem(
      `${restaurantId}_payroll_entries`,
      JSON.stringify(payrollEntries),
    );
    toast.success(`${entry.empName || "Row"} saved`);
  }

  function deleteRow(id: number) {
    const entry = payrollEntries.find((e) => e.id === id);
    if (
      !window.confirm(
        `Delete payroll entry for "${entry?.empName || "this row"}"?`,
      )
    )
      return;
    setPayrollEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("Entry deleted");
  }

  function saveAll() {
    localStorage.setItem(
      `${restaurantId}_payroll_entries`,
      JSON.stringify(payrollEntries),
    );
    toast.success("All payroll entries saved");
  }

  async function exportExcel() {
    const XLSX = await getXLSX();
    const headers = [
      "Employee Name",
      "Role",
      "Basic",
      "HRA",
      "DA",
      "Medical Allow.",
      "TA",
      "Special Allow.",
      "Gross Earnings",
    ];
    const rows = payrollEntries.map((e) => [
      e.empName,
      e.role,
      e.basic,
      e.hra,
      e.da,
      e.medical,
      e.ta,
      e.special,
      e.basic + e.hra + e.da + e.medical + e.ta + e.special,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Payroll");
    XLSX.writeFile(wb, "bulk_payroll.xlsx");
    toast.success("Exported to Excel");
  }

  async function importExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const XLSX = await getXLSX();
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws) as any[];
      setPayrollEntries((prev) => {
        const updated = [...prev];
        for (const row of rows) {
          const name = String(row["Employee Name"] ?? "");
          const idx = updated.findIndex((x) => x.empName === name);
          const entry: PayrollEntry = {
            id: idx >= 0 ? updated[idx].id : Date.now() + Math.random(),
            empName: name,
            role: String(row.Role ?? ""),
            basic: Number(row.Basic) || 0,
            hra: Number(row.HRA) || 0,
            da: Number(row.DA) || 0,
            medical: Number(row["Medical Allow."]) || 0,
            ta: Number(row.TA) || 0,
            special: Number(row["Special Allow."]) || 0,
          };
          if (idx >= 0) updated[idx] = entry;
          else updated.push(entry);
        }
        return updated;
      });
      toast.success("Excel imported successfully");
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  function grossOf(e: PayrollEntry) {
    return e.basic + e.hra + e.da + e.medical + e.ta + e.special;
  }

  const totals = filteredPayrollEntries.reduce(
    (acc, e) => ({
      basic: acc.basic + e.basic,
      hra: acc.hra + e.hra,
      da: acc.da + e.da,
      medical: acc.medical + e.medical,
      ta: acc.ta + e.ta,
      special: acc.special + e.special,
      gross: acc.gross + grossOf(e),
    }),
    { basic: 0, hra: 0, da: 0, medical: 0, ta: 0, special: 0, gross: 0 },
  );

  function addEmployee() {
    if (!newEmp.name || !newEmp.role || !newEmp.salary) {
      toast.error("Fill required fields");
      return;
    }
    const emp: Employee = {
      id: Date.now(),
      name: newEmp.name,
      role: newEmp.role,
      phone: newEmp.phone,
      salary: Number(newEmp.salary),
      advance: Number(newEmp.advance) || 0,
      active: true,
    };
    setEmployees((prev) => [...prev, emp]);
    setAttendance((prev) => ({ ...prev, [emp.id]: {} }));
    setPayrollStatus((prev) => ({ ...prev, [emp.id]: "Pending" }));
    setAdvanceDeductions((prev) => ({ ...prev, [emp.id]: emp.advance }));
    toast.success("Employee added");
    setNewEmp({ name: "", role: "", phone: "", salary: "", advance: "" });
  }

  function toggleCell(empId: number, day: number) {
    setAttendance((prev) => {
      const cur = prev[empId]?.[day] ?? "P";
      const next: AttendanceStatus =
        cur === "P" ? "A" : cur === "A" ? "H" : "P";
      return { ...prev, [empId]: { ...prev[empId], [day]: next } };
    });
  }

  function getStats(empId: number) {
    const att = attendance[empId] ?? {};
    const p = Object.values(att).filter((v) => v === "P").length;
    const a = Object.values(att).filter((v) => v === "A").length;
    const h = Object.values(att).filter((v) => v === "H").length;
    return { p, a, h };
  }

  const attBadge: Record<AttendanceStatus, string> = {
    P: "bg-green-500/20 text-green-400",
    A: "bg-red-500/20 text-red-400",
    H: "bg-yellow-500/20 text-yellow-400",
  };

  // Payslip modal employee data
  const payslipSb = payslipEmp
    ? (() => {
        const { p, h } = getStats(payslipEmp.id);
        const advDed = advanceDeductions[payslipEmp.id] ?? 0;
        return calcSalaryBreakdown(
          payslipEmp.salary,
          p,
          h,
          WORKING_DAYS,
          advDed,
        );
      })()
    : null;

  const payslipMonthLabel = (() => {
    const [y, m] = selectedMonth.split("-");
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  })();

  return (
    <div className="space-y-6 p-6">
      {/* Header with Search */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-foreground whitespace-nowrap">
          Attendance &amp; Payroll
        </h1>
        <div className="relative w-60">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employee..."
            className="pl-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-ocid="attendance.search_input"
          />
        </div>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="bulk-payroll" data-ocid="bulk_payroll.tab">
            Bulk Payroll
          </TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Employee</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>Name *</Label>
                  <Input
                    placeholder="Full name"
                    value={newEmp.name}
                    onChange={(e) =>
                      setNewEmp((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Role *</Label>
                  <Input
                    placeholder="Role"
                    value={newEmp.role}
                    onChange={(e) =>
                      setNewEmp((p) => ({ ...p, role: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    placeholder="Phone"
                    value={newEmp.phone}
                    onChange={(e) =>
                      setNewEmp((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Monthly CTC (₹) *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newEmp.salary}
                    onChange={(e) =>
                      setNewEmp((p) => ({ ...p, salary: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Advance Taken (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newEmp.advance}
                    onChange={(e) =>
                      setNewEmp((p) => ({ ...p, advance: e.target.value }))
                    }
                  />
                </div>
                <Button onClick={addEmployee}>Add Employee</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Monthly CTC</TableHead>
                    <TableHead>Advance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.name}
                      </TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.phone}
                      </TableCell>
                      <TableCell>₹{employee.salary.toLocaleString()}</TableCell>
                      <TableCell>
                        ₹{employee.advance.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={employee.active}
                            onCheckedChange={(v) =>
                              setEmployees((prev) =>
                                prev.map((x) =>
                                  x.id === employee.id
                                    ? { ...x, active: v }
                                    : x,
                                ),
                              )
                            }
                          />
                          <span className="text-sm">
                            {employee.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-6"
                      >
                        No employees match your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Attendance — {selectedMonth}</CardTitle>
                <div className="text-sm text-muted-foreground flex gap-4">
                  <span className="text-green-400">P = Present</span>
                  <span className="text-red-400">A = Absent</span>
                  <span className="text-yellow-400">H = Half Day</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">
                      Employee
                    </TableHead>
                    {DAYS.map((d) => (
                      <TableHead
                        key={d}
                        className="w-8 text-center p-1 text-xs"
                      >
                        {d}
                      </TableHead>
                    ))}
                    <TableHead>P</TableHead>
                    <TableHead>A</TableHead>
                    <TableHead>H</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => {
                    const { p, a, h } = getStats(employee.id);
                    return (
                      <TableRow key={employee.id}>
                        <TableCell className="sticky left-0 bg-card font-medium whitespace-nowrap">
                          {employee.name}
                        </TableCell>
                        {DAYS.map((d) => {
                          const s = attendance[employee.id]?.[d];
                          return (
                            <TableCell key={d} className="p-1 text-center">
                              {s ? (
                                <button
                                  type="button"
                                  onClick={() => toggleCell(employee.id, d)}
                                  className={`text-xs font-bold px-1 py-0.5 rounded ${attBadge[s]}`}
                                >
                                  {s}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleCell(employee.id, d)}
                                  className="text-xs text-muted-foreground px-1"
                                >
                                  -
                                </button>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-green-400 font-semibold">
                          {p}
                        </TableCell>
                        <TableCell className="text-red-400 font-semibold">
                          {a}
                        </TableCell>
                        <TableCell className="text-yellow-400 font-semibold">
                          {h}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={DAYS.length + 4}
                        className="text-center text-muted-foreground py-6"
                      >
                        No employees match your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="mt-4 space-y-4">
          {/* Salary Structure Reference Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm text-primary">
                📋 Govt of India Salary Structure (Reference)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Earnings</p>
                  <p className="text-muted-foreground">Basic: 50% of CTC</p>
                  <p className="text-muted-foreground">HRA: 40% of Basic</p>
                  <p className="text-muted-foreground">DA: 4% of Basic</p>
                  <p className="text-muted-foreground">Medical: ₹1,250 fixed</p>
                  <p className="text-muted-foreground">TA: ₹800 fixed</p>
                  <p className="text-muted-foreground">Special: CTC – above</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Deductions</p>
                  <p className="text-muted-foreground">EPF: 12% of Basic</p>
                  <p className="text-muted-foreground">ESIC: 0.75% of Gross</p>
                  <p className="text-muted-foreground">(if Gross ≤ ₹21,000)</p>
                  <p className="text-muted-foreground">Advance Deduction</p>
                  <p className="text-muted-foreground">TDS: 0</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Net Pay Formula
                  </p>
                  <p className="text-muted-foreground">Gross Earnings</p>
                  <p className="text-muted-foreground">– EPF – ESIC</p>
                  <p className="text-muted-foreground">– Advance Deduction</p>
                  <p className="font-semibold text-green-400 mt-1">= Net Pay</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Attendance Adjust
                  </p>
                  <p className="text-muted-foreground">
                    All values × (Present + Half×0.5) / Working Days
                  </p>
                  <p className="text-muted-foreground">
                    Working Days = {WORKING_DAYS}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Payroll — {selectedMonth}</h2>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 border border-border rounded px-2 text-sm bg-background text-foreground"
            />
            <Button
              onClick={() => {
                setPayrollStatus((prev) =>
                  Object.fromEntries(
                    Object.keys(prev).map((k) => [k, "Paid" as PayrollStatus]),
                  ),
                );
                toast.success("All payroll processed");
              }}
            >
              Process All Payroll
            </Button>
          </div>

          {filteredEmployees.length === 0 && (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No employees match your search.
            </p>
          )}

          {filteredEmployees.map((employee) => {
            const { p, h } = getStats(employee.id);
            const advDed = advanceDeductions[employee.id] ?? 0;
            const sb = calcSalaryBreakdown(
              employee.salary,
              p,
              h,
              WORKING_DAYS,
              advDed,
            );
            const r = (p + h * 0.5) / WORKING_DAYS;
            return (
              <Card key={employee.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-base">{employee.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {employee.role} · CTC ₹
                        {employee.salary.toLocaleString()} · Present: {p}d + {h}{" "}
                        Half ({(r * 100).toFixed(0)}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          payrollStatus[employee.id] === "Paid"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }
                      >
                        {payrollStatus[employee.id]}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Earnings */}
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                      <p className="font-semibold text-green-400 text-xs mb-2 uppercase tracking-wide">
                        Earnings
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Basic</span>
                          <span>₹{sb.basic.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">HRA</span>
                          <span>₹{sb.hra.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">DA</span>
                          <span>₹{sb.da.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Medical Allow.
                          </span>
                          <span>₹{sb.medical.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">TA</span>
                          <span>₹{sb.ta.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Special Allow.
                          </span>
                          <span>₹{sb.special.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t border-green-500/20 pt-1 mt-1">
                          <span>Gross Earnings</span>
                          <span className="text-green-400">
                            ₹{sb.grossEarnings.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                      <p className="font-semibold text-red-400 text-xs mb-2 uppercase tracking-wide">
                        Deductions
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            EPF (12% Basic)
                          </span>
                          <span>₹{sb.epf.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            ESIC (0.75%)
                          </span>
                          <span>₹{sb.esic.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground flex-shrink-0">
                            Advance Ded.
                          </span>
                          <Input
                            type="number"
                            className="w-20 h-6 text-xs text-right"
                            value={advDed}
                            onChange={(evt) =>
                              setAdvanceDeductions((prev) => ({
                                ...prev,
                                [employee.id]: Number(evt.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                        <div className="flex justify-between font-semibold border-t border-red-500/20 pt-1 mt-1">
                          <span>Total Deductions</span>
                          <span className="text-red-400">
                            ₹{sb.totalDeductions.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Net Pay */}
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex flex-col justify-between">
                      <p className="font-semibold text-primary text-xs mb-2 uppercase tracking-wide">
                        Summary
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Gross Earnings
                          </span>
                          <span>₹{sb.grossEarnings.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Deductions
                          </span>
                          <span className="text-red-400">
                            -₹{sb.totalDeductions.toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-primary/20 pt-2 mt-2">
                        <div className="flex justify-between font-bold text-base">
                          <span>NET PAY</span>
                          <span className="text-primary">
                            ₹{Math.max(0, sb.netPay).toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {payrollStatus[employee.id] === "Pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setPayrollStatus((prev) => ({
                                ...prev,
                                [employee.id]: "Paid",
                              }));
                              toast.success(
                                `${employee.name} payroll marked as paid`,
                              );
                            }}
                          >
                            Mark Paid
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1"
                          data-ocid="payroll.payslip_button"
                          onClick={() => setPayslipEmp(employee)}
                        >
                          Payslip
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Bulk Payroll Tab */}
        <TabsContent value="bulk-payroll" className="mt-4 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              size="sm"
              onClick={addBulkRow}
              data-ocid="bulk_payroll.primary_button"
            >
              + Add Row
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={saveAll}
              data-ocid="bulk_payroll.save_button"
            >
              Save All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportExcel}
              data-ocid="bulk_payroll.secondary_button"
            >
              Export Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => importRef.current?.click()}
              data-ocid="bulk_payroll.upload_button"
            >
              Import Excel
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={importExcel}
            />
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="min-w-[130px]">
                      Employee Name
                    </TableHead>
                    <TableHead className="min-w-[100px]">Role</TableHead>
                    <TableHead className="min-w-[90px]">Basic (₹)</TableHead>
                    <TableHead className="min-w-[90px]">HRA (₹)</TableHead>
                    <TableHead className="min-w-[90px]">DA (₹)</TableHead>
                    <TableHead className="min-w-[110px]">
                      Medical Allow. (₹)
                    </TableHead>
                    <TableHead className="min-w-[90px]">TA (₹)</TableHead>
                    <TableHead className="min-w-[110px]">
                      Special Allow. (₹)
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      Gross Earnings (₹)
                    </TableHead>
                    <TableHead className="min-w-[110px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayrollEntries.map((entry, idx) => {
                    const gross = grossOf(entry);
                    return (
                      <TableRow
                        key={entry.id}
                        data-ocid={`bulk_payroll.item.${idx + 1}`}
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 text-sm"
                            value={entry.empName}
                            onChange={(e) =>
                              updateEntry(entry.id, "empName", e.target.value)
                            }
                            data-ocid="bulk_payroll.input"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 text-sm"
                            value={entry.role}
                            onChange={(e) =>
                              updateEntry(entry.id, "role", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-7 text-sm"
                            value={entry.basic}
                            onChange={(e) =>
                              updateEntry(entry.id, "basic", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-7 text-sm"
                            value={entry.hra}
                            onChange={(e) =>
                              updateEntry(entry.id, "hra", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-7 text-sm"
                            value={entry.da}
                            onChange={(e) =>
                              updateEntry(entry.id, "da", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-7 text-sm"
                            value={entry.medical}
                            onChange={(e) =>
                              updateEntry(entry.id, "medical", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-7 text-sm"
                            value={entry.ta}
                            onChange={(e) =>
                              updateEntry(entry.id, "ta", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-7 text-sm"
                            value={entry.special}
                            onChange={(e) =>
                              updateEntry(entry.id, "special", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-bold text-green-400 text-sm">
                          ₹{gross.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              onClick={() => saveRow(entry)}
                              data-ocid="bulk_payroll.save_button"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-red-400 hover:text-red-300"
                              onClick={() => deleteRow(entry.id)}
                              data-ocid={`bulk_payroll.delete_button.${idx + 1}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredPayrollEntries.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="text-center text-muted-foreground py-8"
                        data-ocid="bulk_payroll.empty_state"
                      >
                        {searchQuery
                          ? "No entries match your search."
                          : 'No payroll entries. Click "+ Add Row" to begin.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {/* Summary Footer */}
                {filteredPayrollEntries.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td className="p-2 text-xs font-bold" colSpan={3}>
                        Total
                      </td>
                      <td className="p-2 text-xs font-semibold">
                        ₹{totals.basic.toLocaleString()}
                      </td>
                      <td className="p-2 text-xs font-semibold">
                        ₹{totals.hra.toLocaleString()}
                      </td>
                      <td className="p-2 text-xs font-semibold">
                        ₹{totals.da.toLocaleString()}
                      </td>
                      <td className="p-2 text-xs font-semibold">
                        ₹{totals.medical.toLocaleString()}
                      </td>
                      <td className="p-2 text-xs font-semibold">
                        ₹{totals.ta.toLocaleString()}
                      </td>
                      <td className="p-2 text-xs font-semibold">
                        ₹{totals.special.toLocaleString()}
                      </td>
                      <td className="p-2 text-xs font-bold text-green-400">
                        ₹{totals.gross.toLocaleString()}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payslip Modal */}
      <Dialog
        open={payslipEmp !== null}
        onOpenChange={(open) => !open && setPayslipEmp(null)}
      >
        <DialogContent className="max-w-2xl" data-ocid="payroll.payslip_dialog">
          <DialogHeader>
            <DialogTitle>Payslip</DialogTitle>
          </DialogHeader>

          {payslipEmp && payslipSb && (
            <div className="space-y-4 text-sm" id="payslip-print-area">
              {/* Header */}
              <div className="text-center border-b pb-3">
                <p className="text-lg font-bold text-foreground">
                  {getRestaurantName(restaurantId)}
                </p>
                <p className="text-base font-semibold text-muted-foreground tracking-widest uppercase">
                  PAYSLIP
                </p>
                <p className="text-sm text-muted-foreground">
                  {payslipMonthLabel}
                </p>
              </div>

              {/* Employee Details */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 bg-muted/30 rounded-lg p-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employee Name</span>
                  <span className="font-semibold">{payslipEmp.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employee ID</span>
                  <span className="font-semibold">
                    EMP{String(payslipEmp.id).padStart(4, "0")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Designation</span>
                  <span className="font-semibold">{payslipEmp.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-semibold">
                    {payslipEmp.phone || "—"}
                  </span>
                </div>
              </div>

              {/* Earnings & Deductions side-by-side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="border border-green-500/30 rounded-lg overflow-hidden">
                  <div className="bg-green-500/10 px-3 py-1.5">
                    <p className="font-semibold text-green-400 text-xs uppercase tracking-wide">
                      Earnings
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {[
                      ["Basic", payslipSb.basic],
                      ["HRA", payslipSb.hra],
                      ["DA", payslipSb.da],
                      ["Medical Allow.", payslipSb.medical],
                      ["TA", payslipSb.ta],
                      ["Special Allow.", payslipSb.special],
                    ].map(([label, val]) => (
                      <div
                        key={String(label)}
                        className="flex justify-between px-3 py-1.5"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span>₹{Number(val).toFixed(0)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-1.5 bg-green-500/5 font-semibold">
                      <span>Gross Earnings</span>
                      <span className="text-green-400">
                        ₹{payslipSb.grossEarnings.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-red-500/30 rounded-lg overflow-hidden">
                  <div className="bg-red-500/10 px-3 py-1.5">
                    <p className="font-semibold text-red-400 text-xs uppercase tracking-wide">
                      Deductions
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {[
                      ["EPF (12% of Basic)", payslipSb.epf],
                      ["ESIC (0.75%)", payslipSb.esic],
                      ["Advance Deduction", payslipSb.advance],
                    ].map(([label, val]) => (
                      <div
                        key={String(label)}
                        className="flex justify-between px-3 py-1.5"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span>₹{Number(val).toFixed(0)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-1.5 bg-red-500/5 font-semibold">
                      <span>Total Deductions</span>
                      <span className="text-red-400">
                        ₹{payslipSb.totalDeductions.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg px-4 py-3">
                <span className="text-base font-bold">NET PAY</span>
                <span className="text-xl font-bold text-primary">
                  ₹{Math.max(0, payslipSb.netPay).toFixed(0)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setPayslipEmp(null)}
                  data-ocid="payroll.payslip_dialog.close_button"
                >
                  Close
                </Button>
                <Button
                  onClick={() => window.print()}
                  data-ocid="payroll.payslip_dialog.primary_button"
                >
                  Print Payslip
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { AttendancePayroll };
