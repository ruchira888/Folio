import sys
import pikepdf


def main() -> int:
    if len(sys.argv) < 4:
        print("ERROR: usage protectPdf.py <input> <output> <password>")
        return 1

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    password = sys.argv[3]

    try:
        with pikepdf.open(input_path) as pdf:
            encryption = pikepdf.Encryption(
                owner=password,
                user=password,
                R=6,
                allow=pikepdf.Permissions(
                    accessibility=True,
                    extract=False,
                    modify_annotation=False,
                    modify_assembly=False,
                    modify_form=False,
                    modify_other=False,
                    print_lowres=False,
                    print_highres=False,
                ),
            )
            pdf.save(output_path, encryption=encryption)

        print("SUCCESS")
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
