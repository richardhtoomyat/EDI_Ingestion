import { sftpMock } from '../sftpMock.js'

export const SERVICES = [
  { value: 'ltl-tl', label: 'LTL/TL (Freight)' },
  { value: 'commerce', label: 'Commerce Solutions (Sameday Worldwide)' },
]

export const PARTY_FIELDS = [
  { name: 'accountNumber', label: 'Account #', required: true },
  { name: 'companyName', label: 'Company Name', required: true },
  { name: 'address', label: 'Address' },
  { name: 'city', label: 'City' },
  { name: 'region', label: 'Province / State' },
  { name: 'postal', label: 'Postal / ZIP Code' },
  { name: 'contactName', label: 'Contact Name' },
  { name: 'tel', label: 'Tel.', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
]

export const DEVELOPER_FIELDS = [
  { name: 'developerName', label: 'Developer Name', required: true },
  { name: 'title', label: 'Title' },
  { name: 'tel', label: 'Mobile', type: 'tel' },
  { name: 'otherTel', label: 'Other', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
]

// SCAC is 2–4 letters. ISA06/ISA08 is 15 characters. GS02/GS03 is 2–15.

export const NORMAL_STATUSES = [
  { name: 'Depart Shipper', code: 'AF', at701: 'AF', at702: 'NS' },
  { name: 'Depart Consignee', code: 'CD', at701: 'CD', at702: 'NS' },
  { name: 'Picked up', code: 'CP', at701: 'CP', at702: 'NS' },
  { name: 'Complete Delivery', code: 'D1', at701: 'D1', at702: 'NS' },
  { name: 'Carrier Accept', code: 'J1', at701: 'J1', at702: 'NS' },
  { name: 'Depart Terminal', code: 'P1', at701: 'P1', at702: 'NS' },
  { name: 'Drop Trailer', code: 'S1', at701: 'S1', at702: 'NS' },
  { name: 'Arrive Consignee', code: 'X1', at701: 'X1', at702: 'NS' },
  { name: 'Arrive Shippers', code: 'X3', at701: 'X3', at702: 'NS' },
  { name: 'Arrive Terminal', code: 'X4', at701: 'X4', at702: 'NS' },
  { name: 'Out for Delivery', code: 'X6', at701: 'X6', at702: 'NS' },
  { name: 'Freight Bill Entered', code: 'XB', at701: 'XB', at702: 'NS' },
  { name: 'Estimated Delivery Date', code: 'AG', at701: 'AG', at702: 'NS' },
  { name: 'Tendered for Delivery', code: 'AJ', at701: 'AJ', at702: 'NS' },
  { name: 'Available for Delivery', code: 'AV', at701: 'AV', at702: 'NS' },
  { name: 'Storage Yard', code: 'BC', at701: 'BC', at702: 'NS' },
  { name: 'In-Gate', code: 'I1', at701: 'I1', at702: 'NS' },
  { name: 'Paperwork Received - Did not Receive Shipment or Equipment', code: 'OO', at701: 'OO', at702: 'BG' },
  { name: "Estimated Date and/or Time of Arrival at Consignee's Location", code: 'X2', at701: 'X2', at702: 'NS' },
  { name: 'Arrived at Delivery Location Loading Dock', code: 'X5', at701: 'X5', at702: 'NS' },
  { name: 'Arrived at Pick-up Location Loading Dock', code: 'X8', at701: 'X8', at702: 'NS' },
]

export const EXCEPTION_STATUSES = [
  { name: 'Refused', code: 'A7', at701: 'A7', at702: 'BS' },
  { name: 'OSD Released', code: 'A9', at701: 'A9', at702: 'BG' },
  { name: 'Attempted Delivery', code: 'AH', at701: 'AH', at702: 'NS' },
  { name: 'Cancelled', code: 'CA', at701: 'CA', at702: 'BG' },
  { name: 'Shipment Returned to Shipper', code: 'A3', at701: 'A3', at702: 'BG' },
  { name: 'Hold for Appointment', code: 'SD', at701: 'SD', at702: 'HB' },
  { name: 'Attempt to Contact Consignee', code: 'SD', at701: 'SD', at702: 'AG' },
  { name: 'Consignee Not Receiving', code: 'SD', at701: 'SD', at702: 'B1' },
  { name: 'Ferry Delay', code: 'SD', at701: 'SD', at702: 'BI' },
  { name: 'Consignee Closed for Holiday', code: 'SD', at701: 'SD', at702: 'AN' },
  { name: 'Shipper Tender Late', code: 'SD', at701: 'SD', at702: 'T7' },
  { name: 'Weather Delay', code: 'SD', at701: 'SD', at702: 'AO' },
  { name: 'Trailer in Accident', code: 'SD', at701: 'SD', at702: 'AF' },
  { name: 'Vehicle Breakdown', code: 'SD', at701: 'SD', at702: 'AI' },
  { name: 'Hazmat or Incomplete Documentation', code: 'SD', at701: 'SD', at702: 'BC' },
  { name: 'Incomplete Paper', code: 'SD', at701: 'SD', at702: 'AR' },
  { name: 'No Correct Brok Info', code: 'SD', at701: 'SD', at702: 'AM' },
  { name: 'Consignee Closed', code: 'SD', at701: 'SD', at702: 'B1' },
  { name: 'Unable to Locate', code: 'SD', at701: 'SD', at702: 'A5' },
  { name: 'Reconsigned', code: 'SD', at701: 'SD', at702: 'RC' },
  { name: 'Hold Strike', code: 'SD', at701: 'SD', at702: 'C5' },
]

export const TRANSACTION_SETS = [
  { code: '204', name: 'Load Tender' },
  { code: '211', name: 'Bill of Lading' },
  { code: '210', name: 'Invoice' },
  { code: '214', name: 'Shipment Status' },
  { code: '997', name: 'Acknowledgement for 210, 211 and 214' },
  { code: '990', name: 'Accept or Reject for 204' },
  { code: '820', name: 'Payment / Remittance Advice' },
  { code: '824', name: 'Rejection Advice' },
]

export const SFTP_FIELDS = [
  { name: 'server', label: 'SFTP Server ID' },
  { name: 'port', label: 'SFTP Port' },
  { name: 'username', label: 'Username' },
  { name: 'password', label: 'Password', type: 'password' },
  { name: 'qualifier', label: 'Qualifier / Sender-Receiver ID' },
  { name: 'directories', label: 'Directories' },
]

const blank = (fields) => Object.fromEntries(fields.map((f) => [f.name, '']))

const party = () => ({ ...blank(PARTY_FIELDS), accountSystem: '' })

export const initialState = () => ({
  type: 'New',
  services: [],
  mainAccount: party(),
  logisticsProvider: party(),
  additionalLocations: '',
  paymentHouse: { companyName: '', contactName: '' },
  developer: blank(DEVELOPER_FIELDS),
  sets: [],
  x12: { scac: '', isa: '', gs: '' },
  normalStatuses: [],
  normalCodes: {},
  normalOpen: [],
  exceptionStatuses: [],
  exceptionCodes: {},
  exceptionOpen: [],
  kickoffWeeks: [],
  as2: false,
  sftp: false,
  sftpDetails: {
    ...blank(SFTP_FIELDS),
    server: import.meta.env.DEV ? '127.0.0.1' : sftpMock.host,
    port: sftpMock.port,
    username: sftpMock.username,
    password: sftpMock.password,
    directories: sftpMock.folder,
  },
  authorization: { name: '', title: '', company: '', paymentHouseAuth: '', comments: '', date: new Date().toISOString().slice(0, 10) },
})
