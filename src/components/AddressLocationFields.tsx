import { Building2, MapPin } from "lucide-react";
import { useId } from "react";

const districtsByDivision = {
  Barishal: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  Chattogram: ["Bandarban", "Brahmanbaria", "Chandpur", "Chattogram", "Cumilla", "Cox's Bazar", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati"],
  Dhaka: ["Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur", "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari", "Shariatpur", "Tangail"],
  Khulna: ["Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"],
  Mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
  Rajshahi: ["Bogura", "Chapai Nawabganj", "Joypurhat", "Naogaon", "Natore", "Pabna", "Rajshahi", "Sirajganj"],
  Rangpur: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"],
  Sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
} as const;

const divisions = Object.keys(districtsByDivision);
const districts = Object.entries(districtsByDivision).flatMap(([division, names]) =>
  names.map((name) => ({ name, division })),
);

function findDistrict(name: string) {
  return districts.find((district) => district.name.toLowerCase() === name.trim().toLowerCase());
}

export function AddressLocationFields({
  district,
  division,
  onChange,
  banglaLabels = false,
  requiredFields = false,
  selectFields = false,
}: {
  district: string;
  division: string;
  onChange: (location: { district: string; division: string }) => void;
  banglaLabels?: boolean;
  requiredFields?: boolean;
  selectFields?: boolean;
}) {
  const id = useId();
  const districtListId = `${id}-districts`;
  const divisionListId = `${id}-divisions`;
  const visibleDistricts = division
    ? districts.filter((item) => item.division.toLowerCase() === division.trim().toLowerCase())
    : districts;

  return (
    <>
      <label className="field">
        <span className={selectFields ? "checkout-field-label" : undefined}>
          {selectFields ? <Building2 size={16} aria-hidden="true" /> : null}
          {banglaLabels ? "বিভাগ" : "Division / Area"}
        </span>
        {selectFields ? (
          <select
            required={requiredFields}
            autoComplete="address-level1"
            value={divisions.find((name) => name.toLowerCase() === division.trim().toLowerCase()) ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              const currentDistrict = findDistrict(district);
              onChange({
                division: value,
                district:
                  currentDistrict && currentDistrict.division.toLowerCase() !== value.toLowerCase()
                    ? ""
                    : district,
              });
            }}
          >
            <option value="">{banglaLabels ? "বিভাগ নির্বাচন করুন" : "Select division"}</option>
            {divisions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        ) : (
          <>
            <input
              list={divisionListId}
              autoComplete="address-level1"
              placeholder={banglaLabels ? "বিভাগ নির্বাচন করুন" : "Type or select a division"}
              value={division}
              onChange={(event) => {
                const value = event.target.value;
                const validDivision = divisions.some((name) => name.toLowerCase() === value.trim().toLowerCase());
                const currentDistrict = findDistrict(district);
                onChange({
                  division: value,
                  district: validDivision && currentDistrict && currentDistrict.division.toLowerCase() !== value.trim().toLowerCase()
                    ? ""
                    : district,
                });
              }}
            />
            <datalist id={divisionListId}>
              {divisions.map((name) => <option key={name} value={name} />)}
            </datalist>
          </>
        )}
      </label>
      <label className="field">
        <span className={selectFields ? "checkout-field-label" : undefined}>
          {selectFields ? <MapPin size={16} aria-hidden="true" /> : null}
          {banglaLabels ? "জেলা" : "District / City"}
        </span>
        {selectFields ? (
          <select
            required
            autoComplete="address-level2"
            value={visibleDistricts.find((item) => item.name.toLowerCase() === district.trim().toLowerCase())?.name ?? ""}
            onChange={(event) => onChange({ district: event.target.value, division })}
          >
            <option value="">{banglaLabels ? "জেলা নির্বাচন করুন" : "Select district"}</option>
            {visibleDistricts.map(({ name }) => <option key={name} value={name}>{name}</option>)}
          </select>
        ) : (
          <>
            <input
              required
              minLength={2}
              list={districtListId}
              autoComplete="address-level2"
              placeholder={banglaLabels
                ? division ? `${division} বিভাগের জেলা নির্বাচন করুন` : "জেলা নির্বাচন করুন"
                : division ? `Type or select a district in ${division}` : "Type or select a district"}
              value={district}
              onChange={(event) => onChange({ district: event.target.value, division })}
            />
            <datalist id={districtListId}>
              {visibleDistricts.map(({ name }) => <option key={name} value={name} />)}
            </datalist>
          </>
        )}
      </label>
    </>
  );
}
