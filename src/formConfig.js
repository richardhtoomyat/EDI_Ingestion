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
  { name: 'fax', label: 'Fax', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
]

export const DEVELOPER_FIELDS = [
  { name: 'developerName', label: 'Developer Name', required: true },
  { name: 'title', label: 'Title' },
  { name: 'tel', label: 'Tel.', type: 'tel' },
  { name: 'fax', label: 'Fax', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
]

// SCAC is 2–4 letters. ISA06/ISA08 is 15 characters. GS02/GS03 is 2–15.

export const NORMAL_STATUSES = [
  { code: 'P', name: 'Pick up' },
  { code: 'AF', name: 'Departed Pickup Location' },
  { code: 'X6', name: 'En Route to Delivery Location' },
  { code: 'X1', name: 'Arrived at Delivery Location' },
  { code: 'D1', name: 'Completed Unloading at Delivery Location' },
  { code: 'A9', name: 'Shipment Damaged' },
  { code: 'X3', name: 'Arrived at Pickup Location' },
  { code: 'X4', name: 'Arrived at Terminal Location' },
  { code: 'P1', name: 'Departed Terminal Location' },
  { code: 'X5', name: 'Arrived at Delivery Location Loading Dock' },
  { code: 'OO', name: 'Paperwork Received' },
  { code: 'AV', name: 'Available for Delivery' },
  { code: 'AI', name: 'Shipment has been Reconsigned' },
  { code: 'AJ', name: 'Tendered for Delivery' },
  { code: 'SD', name: 'Shipment Delayed' },
  { code: 'AH', name: 'Attempted Delivery' },
  { code: 'A7', name: 'Refused by Consignee' },
  { code: 'X8', name: 'Arrived at Pickup Location Loading Dock' },
]

export const EXCEPTION_STATUSES = [
  { code: 'AP', name: 'Shipment Cancelled' },
  { code: 'A3', name: 'Shipment Returned to Shipper' },
  { code: 'AB', name: 'Delivery Appointment' },
  { code: 'AC', name: 'Delivery Appointment' },
  { code: 'ED', name: 'Estimated Delivery Appointment' },
  { code: 'X2', name: 'Estimated to Arrive at Terminal' },
  { code: 'AG', name: 'Estimated to Depart Terminal' },
  { code: 'CD', name: 'Hold' },
  { code: 'K1', name: 'Arrived at Customs' },
  { code: 'CR', name: 'Customs Released' },
  { code: 'BA', name: 'Inbond Paperwork Filed' },
  { code: 'BC', name: 'Border Crossed' },
  { code: 'C2', name: 'Canada Customs Held' },
  { code: 'AB', name: 'Pickup Appointment Date/Time' },
  { code: 'SD', name: 'Shipment Delayed' },
  { code: 'A7', name: 'Delivery Refused' },
  { code: 'A28', name: 'Load Refused' },
  { code: 'AP', name: 'Undeliverable Shipment' },
  { code: 'CL', name: 'Trailer Closed Out' },
  { code: 'S1', name: 'Trailer Spotted at Delivery Location' },
  { code: 'S2', name: 'Trailer Spotted at Pickup Location' },
  { code: 'AH', name: 'Attempted Delivery' },
]

// dayRoss / customer: which side provides specs for this transaction set (null = not offered)
export const TRANSACTION_SETS = [
  { code: '204', name: 'Load Tender - Inbound - Day & Ross Receives', dayRoss: true, customer: true },
  { code: '211', name: 'Bill of Lading - Inbound - Day & Ross Receives', dayRoss: true, customer: true },
  { code: '210', name: 'Invoice - Outbound - Day & Ross Sends', dayRoss: true, customer: true },
  { code: '214', name: 'Shipments Status - Outbound - Day & Ross Sends', dayRoss: true, customer: true },
  { code: '997', name: 'Acknowledgement 210, 211 & 214', dayRoss: true, customer: false },
  { code: '990', name: 'Acknowledgement/Accept-Reject 204', dayRoss: true, customer: false },
  { code: '820', name: 'Payment/Remittance Advice - Inbound - Day & Ross Receives', dayRoss: false, customer: true },
  { code: '824', name: 'Rejection Advice', dayRoss: false, customer: true },
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
  sets: { dayRoss: [], customer: [] },
  x12: { scac: '', isa: '', gs: '' },
  normalStatuses: [],
  exceptionStatuses: [],
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
